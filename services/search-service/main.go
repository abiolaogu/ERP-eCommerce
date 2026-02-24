package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

type searchIndex struct {
	ID               string     `json:"id"`
	TenantID         string     `json:"tenant_id"`
	IndexName        string     `json:"index_name"`
	EntityType       string     `json:"entity_type"`
	DocumentCount    int        `json:"document_count"`
	FieldMappingsJSON string    `json:"field_mappings_json,omitempty"`
	SynonymsJSON     string     `json:"synonyms_json,omitempty"`
	BoostRulesJSON   string     `json:"boost_rules_json,omitempty"`
	Status           string     `json:"status"`
	LastRebuiltAt    *time.Time `json:"last_rebuilt_at,omitempty"`
	ConfigJSON       string     `json:"config_json,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type createSearchIndexRequest struct {
	IndexName        string `json:"index_name"`
	EntityType       string `json:"entity_type"`
	DocumentCount    int    `json:"document_count"`
	FieldMappingsJSON string `json:"field_mappings_json"`
	SynonymsJSON     string `json:"synonyms_json"`
	BoostRulesJSON   string `json:"boost_rules_json"`
	Status           string `json:"status"`
	ConfigJSON       string `json:"config_json"`
}

type updateSearchIndexRequest struct {
	IndexName        *string `json:"index_name,omitempty"`
	EntityType       *string `json:"entity_type,omitempty"`
	DocumentCount    *int    `json:"document_count,omitempty"`
	FieldMappingsJSON *string `json:"field_mappings_json,omitempty"`
	SynonymsJSON     *string `json:"synonyms_json,omitempty"`
	BoostRulesJSON   *string `json:"boost_rules_json,omitempty"`
	Status           *string `json:"status,omitempty"`
	ConfigJSON       *string `json:"config_json,omitempty"`
}

type listResponse struct {
	Items      []searchIndex `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
	Cached     bool          `json:"cached"`
}

type cacheItem struct {
	Response listResponse
	Expires  time.Time
}

type service struct {
	db        *sql.DB
	cacheTTL  time.Duration
	cacheMu   sync.RWMutex
	listCache map[string]cacheItem
	memMu     sync.RWMutex
	memByID   map[string]searchIndex
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

func main() {
	port := env("PORT", "8080")
	module := env("MODULE_NAME", "ERP-eCommerce")
	svc := &service{
		cacheTTL:  durationEnv("CACHE_TTL", 45*time.Second),
		listCache: make(map[string]cacheItem),
		memByID:   make(map[string]searchIndex),
	}

	if db, err := connectDB(); err != nil {
		log.Printf("warn: database unavailable, running search in memory mode: %v", err)
	} else {
		svc.db = db
		if err := svc.ensureSchema(context.Background()); err != nil {
			log.Printf("warn: schema setup failed, using memory mode: %v", err)
			_ = svc.db.Close()
			svc.db = nil
		}
	}
	defer func() {
		if svc.db != nil {
			_ = svc.db.Close()
		}
	}()

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		mode := "postgres"
		if svc.db == nil {
			mode = "memory"
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "healthy", "module": module, "service": "search-service", "mode": mode})
	})

	base := "/v1/search-indexes"

	mux.HandleFunc(base+"/_explain", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		tenantID := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
		if tenantID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing X-Tenant-ID"})
			return
		}
		entityType := strings.TrimSpace(r.URL.Query().Get("entity_type"))
		status := strings.TrimSpace(r.URL.Query().Get("status"))
		plan, err := svc.explainList(r.Context(), tenantID, entityType, status)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"plan": plan, "event_topic": "erp.ecommerce.search-index.explain.generated"})
	})

	mux.HandleFunc(base, func(w http.ResponseWriter, r *http.Request) {
		tenantID := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
		if tenantID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing X-Tenant-ID"})
			return
		}

		switch r.Method {
		case http.MethodGet:
			limit := intParam(r, "limit", 50, 1, 200)
			cursor := strings.TrimSpace(r.URL.Query().Get("cursor"))
			entityType := strings.TrimSpace(r.URL.Query().Get("entity_type"))
			status := strings.TrimSpace(r.URL.Query().Get("status"))
			resp, err := svc.listIndexes(r.Context(), tenantID, entityType, status, cursor, limit)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": resp.Items, "next_cursor": resp.NextCursor, "cached": resp.Cached, "event_topic": "erp.ecommerce.search-index.listed"})
		case http.MethodPost:
			var req createSearchIndexRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			idx, err := buildCreateIndex(tenantID, req)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			if err := svc.createIndex(r.Context(), idx); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"item": idx, "event_topic": "erp.ecommerce.search-index.created"})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
	})

	mux.HandleFunc(base+"/", func(w http.ResponseWriter, r *http.Request) {
		tenantID := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
		if tenantID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing X-Tenant-ID"})
			return
		}
		id := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, base+"/"))
		if id == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing id"})
			return
		}

		switch r.Method {
		case http.MethodGet:
			idx, err := svc.getByID(r.Context(), tenantID, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "search index not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": idx, "event_topic": "erp.ecommerce.search-index.read"})
		case http.MethodPut, http.MethodPatch:
			var req updateSearchIndexRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			updated, err := svc.updateIndex(r.Context(), tenantID, id, req)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "search index not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": updated, "event_topic": "erp.ecommerce.search-index.updated"})
		case http.MethodDelete:
			if err := svc.deleteIndex(r.Context(), tenantID, id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "search index not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "event_topic": "erp.ecommerce.search-index.deleted"})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
	})

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           withServerDefaults(mux),
		ReadHeaderTimeout: 2 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	log.Printf("search-service listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}

// ---------------------------------------------------------------------------
// Build / Validate
// ---------------------------------------------------------------------------

func buildCreateIndex(tenantID string, req createSearchIndexRequest) (searchIndex, error) {
	if strings.TrimSpace(req.IndexName) == "" {
		return searchIndex{}, errors.New("index_name is required")
	}
	if strings.TrimSpace(req.EntityType) == "" {
		return searchIndex{}, errors.New("entity_type is required")
	}
	status := normalizeStatus(req.Status)
	if status == "" {
		status = "building"
	}
	now := time.Now().UTC()
	return searchIndex{
		ID:                newID(),
		TenantID:          tenantID,
		IndexName:         strings.TrimSpace(req.IndexName),
		EntityType:        strings.TrimSpace(req.EntityType),
		DocumentCount:     req.DocumentCount,
		FieldMappingsJSON: req.FieldMappingsJSON,
		SynonymsJSON:      req.SynonymsJSON,
		BoostRulesJSON:    req.BoostRulesJSON,
		Status:            status,
		ConfigJSON:        req.ConfigJSON,
		CreatedAt:         now,
		UpdatedAt:         now,
	}, nil
}

func normalizeStatus(status string) string {
	s := strings.ToLower(strings.TrimSpace(status))
	switch s {
	case "building", "active", "stale", "error":
		return s
	default:
		return ""
	}
}

// ---------------------------------------------------------------------------
// DB / Schema
// ---------------------------------------------------------------------------

func connectDB() (*sql.DB, error) {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		host := env("DB_HOST", "")
		if host == "" {
			return nil, errors.New("missing DATABASE_URL or DB_HOST")
		}
		port := env("DB_PORT", "5432")
		user := env("DB_USER", "postgres")
		pass := env("DB_PASSWORD", "postgres")
		name := env("DB_NAME", "erp_ecommerce")
		ssl := env("DB_SSLMODE", "disable")
		dsn = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s", user, pass, host, port, name, ssl)
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(intEnv("DB_MAX_OPEN_CONNS", 60))
	db.SetMaxIdleConns(intEnv("DB_MAX_IDLE_CONNS", 20))
	db.SetConnMaxIdleTime(durationEnv("DB_CONN_MAX_IDLE", 5*time.Minute))
	db.SetConnMaxLifetime(durationEnv("DB_CONN_MAX_LIFETIME", 30*time.Minute))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func (s *service) ensureSchema(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS ecommerce_search_indexes (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			index_name TEXT NOT NULL,
			entity_type TEXT NOT NULL,
			document_count INT DEFAULT 0,
			field_mappings_json TEXT,
			synonyms_json TEXT,
			boost_rules_json TEXT,
			status TEXT CHECK (status IN ('building','active','stale','error')) DEFAULT 'building',
			last_rebuilt_at TIMESTAMPTZ,
			config_json TEXT,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_search_indexes_tenant_created ON ecommerce_search_indexes (tenant_id, created_at DESC, id DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_search_indexes_tenant_entity ON ecommerce_search_indexes (tenant_id, entity_type)`,
		`CREATE INDEX IF NOT EXISTS idx_search_indexes_tenant_status ON ecommerce_search_indexes (tenant_id, status)`,
	}
	for _, stmt := range stmts {
		if _, err := s.db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// CRUD - Create
// ---------------------------------------------------------------------------

func (s *service) createIndex(ctx context.Context, idx searchIndex) error {
	if s.db == nil {
		s.memMu.Lock()
		s.memByID[idx.ID] = idx
		s.memMu.Unlock()
		s.invalidateTenantCache(idx.TenantID)
		return nil
	}
	q := `INSERT INTO ecommerce_search_indexes (id, tenant_id, index_name, entity_type, document_count, field_mappings_json, synonyms_json, boost_rules_json, status, last_rebuilt_at, config_json, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`
	if _, err := s.db.ExecContext(ctx, q,
		idx.ID, idx.TenantID, idx.IndexName, idx.EntityType, idx.DocumentCount,
		nilIfEmpty(idx.FieldMappingsJSON), nilIfEmpty(idx.SynonymsJSON), nilIfEmpty(idx.BoostRulesJSON),
		idx.Status, idx.LastRebuiltAt, nilIfEmpty(idx.ConfigJSON), idx.CreatedAt, idx.UpdatedAt,
	); err != nil {
		return err
	}
	s.invalidateTenantCache(idx.TenantID)
	return nil
}

// ---------------------------------------------------------------------------
// CRUD - Read
// ---------------------------------------------------------------------------

func (s *service) getByID(ctx context.Context, tenantID, id string) (searchIndex, error) {
	if s.db == nil {
		s.memMu.RLock()
		idx, ok := s.memByID[id]
		s.memMu.RUnlock()
		if !ok || idx.TenantID != tenantID {
			return searchIndex{}, sql.ErrNoRows
		}
		return idx, nil
	}

	q := `SELECT id, tenant_id, index_name, entity_type, document_count, field_mappings_json, synonyms_json, boost_rules_json, status, last_rebuilt_at, config_json, created_at, updated_at
		FROM ecommerce_search_indexes WHERE tenant_id=$1 AND id=$2`
	var idx searchIndex
	var fmJSON, synJSON, brJSON, cfgJSON sql.NullString
	var lastRebuilt sql.NullTime
	err := s.db.QueryRowContext(ctx, q, tenantID, id).Scan(
		&idx.ID, &idx.TenantID, &idx.IndexName, &idx.EntityType, &idx.DocumentCount,
		&fmJSON, &synJSON, &brJSON, &idx.Status, &lastRebuilt, &cfgJSON,
		&idx.CreatedAt, &idx.UpdatedAt,
	)
	if err != nil {
		return searchIndex{}, err
	}
	idx.FieldMappingsJSON = fmJSON.String
	idx.SynonymsJSON = synJSON.String
	idx.BoostRulesJSON = brJSON.String
	idx.ConfigJSON = cfgJSON.String
	if lastRebuilt.Valid {
		idx.LastRebuiltAt = &lastRebuilt.Time
	}
	return idx, nil
}

// ---------------------------------------------------------------------------
// CRUD - List
// ---------------------------------------------------------------------------

func (s *service) listIndexes(ctx context.Context, tenantID, entityType, status, cursor string, limit int) (listResponse, error) {
	if cursor == "" {
		if cached, ok := s.getListCache(tenantID, entityType, status, cursor, limit); ok {
			cached.Cached = true
			return cached, nil
		}
	}

	if s.db == nil {
		resp := s.listIndexesMemory(tenantID, entityType, status, cursor, limit)
		if cursor == "" {
			s.setListCache(tenantID, entityType, status, cursor, limit, resp)
		}
		return resp, nil
	}

	cursorTime, cursorID, err := parseCursor(cursor)
	if err != nil {
		return listResponse{}, err
	}

	args := []any{tenantID}
	where := []string{"tenant_id = $1"}
	nextArg := 2
	if entityType != "" {
		where = append(where, fmt.Sprintf("entity_type = $%d", nextArg))
		args = append(args, entityType)
		nextArg++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	if !cursorTime.IsZero() {
		where = append(where, fmt.Sprintf("(created_at, id) < ($%d, $%d)", nextArg, nextArg+1))
		args = append(args, cursorTime, cursorID)
		nextArg += 2
	}
	args = append(args, limit+1)
	q := fmt.Sprintf(`
		SELECT id, tenant_id, index_name, entity_type, document_count, field_mappings_json, synonyms_json, boost_rules_json, status, last_rebuilt_at, config_json, created_at, updated_at
		FROM ecommerce_search_indexes
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), nextArg)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return listResponse{}, err
	}
	defer rows.Close()

	items := make([]searchIndex, 0, limit)
	for rows.Next() {
		var idx searchIndex
		var fm, syn, br, cfg sql.NullString
		var lr sql.NullTime
		if err := rows.Scan(&idx.ID, &idx.TenantID, &idx.IndexName, &idx.EntityType, &idx.DocumentCount,
			&fm, &syn, &br, &idx.Status, &lr, &cfg, &idx.CreatedAt, &idx.UpdatedAt); err != nil {
			return listResponse{}, err
		}
		idx.FieldMappingsJSON = fm.String
		idx.SynonymsJSON = syn.String
		idx.BoostRulesJSON = br.String
		idx.ConfigJSON = cfg.String
		if lr.Valid {
			idx.LastRebuiltAt = &lr.Time
		}
		items = append(items, idx)
	}
	if err := rows.Err(); err != nil {
		return listResponse{}, err
	}

	resp := listResponse{Items: items}
	if len(items) > limit {
		last := items[limit-1]
		resp.Items = items[:limit]
		resp.NextCursor = encodeCursor(last.CreatedAt, last.ID)
	}
	if cursor == "" {
		s.setListCache(tenantID, entityType, status, cursor, limit, resp)
	}
	return resp, nil
}

func (s *service) listIndexesMemory(tenantID, entityType, status, cursor string, limit int) listResponse {
	s.memMu.RLock()
	items := make([]searchIndex, 0)
	for _, idx := range s.memByID {
		if idx.TenantID != tenantID {
			continue
		}
		if entityType != "" && idx.EntityType != entityType {
			continue
		}
		if status != "" && idx.Status != normalizeStatus(status) {
			continue
		}
		items = append(items, idx)
	}
	s.memMu.RUnlock()

	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].ID > items[j].ID
		}
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})

	if cursor != "" {
		cursorTime, cursorID, err := parseCursor(cursor)
		if err == nil {
			filtered := items[:0]
			for _, it := range items {
				if it.CreatedAt.Before(cursorTime) || (it.CreatedAt.Equal(cursorTime) && it.ID < cursorID) {
					filtered = append(filtered, it)
				}
			}
			items = filtered
		}
	}

	resp := listResponse{}
	if len(items) <= limit {
		resp.Items = append(resp.Items, items...)
		return resp
	}
	resp.Items = append(resp.Items, items[:limit]...)
	last := items[limit-1]
	resp.NextCursor = encodeCursor(last.CreatedAt, last.ID)
	return resp
}

// ---------------------------------------------------------------------------
// CRUD - Update
// ---------------------------------------------------------------------------

func (s *service) updateIndex(ctx context.Context, tenantID, id string, req updateSearchIndexRequest) (searchIndex, error) {
	if req.IndexName == nil && req.EntityType == nil && req.DocumentCount == nil &&
		req.FieldMappingsJSON == nil && req.SynonymsJSON == nil && req.BoostRulesJSON == nil &&
		req.Status == nil && req.ConfigJSON == nil {
		return searchIndex{}, errors.New("empty update payload")
	}

	if s.db == nil {
		s.memMu.Lock()
		idx, ok := s.memByID[id]
		if !ok || idx.TenantID != tenantID {
			s.memMu.Unlock()
			return searchIndex{}, sql.ErrNoRows
		}
		if req.IndexName != nil {
			idx.IndexName = strings.TrimSpace(*req.IndexName)
		}
		if req.EntityType != nil {
			idx.EntityType = strings.TrimSpace(*req.EntityType)
		}
		if req.DocumentCount != nil {
			idx.DocumentCount = *req.DocumentCount
		}
		if req.FieldMappingsJSON != nil {
			idx.FieldMappingsJSON = *req.FieldMappingsJSON
		}
		if req.SynonymsJSON != nil {
			idx.SynonymsJSON = *req.SynonymsJSON
		}
		if req.BoostRulesJSON != nil {
			idx.BoostRulesJSON = *req.BoostRulesJSON
		}
		if req.Status != nil {
			ns := normalizeStatus(*req.Status)
			if ns == "" {
				s.memMu.Unlock()
				return searchIndex{}, errors.New("invalid status")
			}
			idx.Status = ns
			if ns == "active" {
				now := time.Now().UTC()
				idx.LastRebuiltAt = &now
			}
		}
		if req.ConfigJSON != nil {
			idx.ConfigJSON = *req.ConfigJSON
		}
		idx.UpdatedAt = time.Now().UTC()
		s.memByID[id] = idx
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return idx, nil
	}

	assignments := make([]string, 0, 9)
	args := []any{tenantID, id}
	next := 3
	if req.IndexName != nil {
		assignments = append(assignments, fmt.Sprintf("index_name = $%d", next))
		args = append(args, strings.TrimSpace(*req.IndexName))
		next++
	}
	if req.EntityType != nil {
		assignments = append(assignments, fmt.Sprintf("entity_type = $%d", next))
		args = append(args, strings.TrimSpace(*req.EntityType))
		next++
	}
	if req.DocumentCount != nil {
		assignments = append(assignments, fmt.Sprintf("document_count = $%d", next))
		args = append(args, *req.DocumentCount)
		next++
	}
	if req.FieldMappingsJSON != nil {
		assignments = append(assignments, fmt.Sprintf("field_mappings_json = $%d", next))
		args = append(args, *req.FieldMappingsJSON)
		next++
	}
	if req.SynonymsJSON != nil {
		assignments = append(assignments, fmt.Sprintf("synonyms_json = $%d", next))
		args = append(args, *req.SynonymsJSON)
		next++
	}
	if req.BoostRulesJSON != nil {
		assignments = append(assignments, fmt.Sprintf("boost_rules_json = $%d", next))
		args = append(args, *req.BoostRulesJSON)
		next++
	}
	if req.Status != nil {
		ns := normalizeStatus(*req.Status)
		if ns == "" {
			return searchIndex{}, errors.New("invalid status")
		}
		assignments = append(assignments, fmt.Sprintf("status = $%d", next))
		args = append(args, ns)
		next++
		if ns == "active" {
			assignments = append(assignments, fmt.Sprintf("last_rebuilt_at = $%d", next))
			args = append(args, time.Now().UTC())
			next++
		}
	}
	if req.ConfigJSON != nil {
		assignments = append(assignments, fmt.Sprintf("config_json = $%d", next))
		args = append(args, *req.ConfigJSON)
		next++
	}

	assignments = append(assignments, fmt.Sprintf("updated_at = $%d", next))
	args = append(args, time.Now().UTC())

	q := fmt.Sprintf(`UPDATE ecommerce_search_indexes SET %s WHERE tenant_id = $1 AND id = $2`, strings.Join(assignments, ", "))
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return searchIndex{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return searchIndex{}, err
	}
	if affected == 0 {
		return searchIndex{}, sql.ErrNoRows
	}
	s.invalidateTenantCache(tenantID)
	return s.getByID(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// CRUD - Delete
// ---------------------------------------------------------------------------

func (s *service) deleteIndex(ctx context.Context, tenantID, id string) error {
	if s.db == nil {
		s.memMu.Lock()
		idx, ok := s.memByID[id]
		if !ok || idx.TenantID != tenantID {
			s.memMu.Unlock()
			return sql.ErrNoRows
		}
		delete(s.memByID, id)
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return nil
	}

	res, err := s.db.ExecContext(ctx, `DELETE FROM ecommerce_search_indexes WHERE tenant_id=$1 AND id=$2`, tenantID, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	s.invalidateTenantCache(tenantID)
	return nil
}

// ---------------------------------------------------------------------------
// Explain
// ---------------------------------------------------------------------------

func (s *service) explainList(ctx context.Context, tenantID, entityType, status string) (any, error) {
	if s.db == nil {
		return map[string]any{"mode": "memory", "note": "no SQL plan available"}, nil
	}

	args := []any{tenantID}
	where := []string{"tenant_id = $1"}
	nextArg := 2
	if entityType != "" {
		where = append(where, fmt.Sprintf("entity_type = $%d", nextArg))
		args = append(args, entityType)
		nextArg++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	planQuery := fmt.Sprintf(`EXPLAIN (ANALYZE FALSE, FORMAT JSON)
		SELECT id, tenant_id, index_name, entity_type, document_count, field_mappings_json, synonyms_json, boost_rules_json, status, last_rebuilt_at, config_json, created_at, updated_at
		FROM ecommerce_search_indexes
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT 50`, strings.Join(where, " AND "))

	var planRaw []byte
	if err := s.db.QueryRowContext(ctx, planQuery, args...).Scan(&planRaw); err != nil {
		return nil, err
	}
	var parsed any
	if err := json.Unmarshal(planRaw, &parsed); err != nil {
		return string(planRaw), nil
	}
	return parsed, nil
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

func (s *service) getListCache(tenantID, entityType, status, cursor string, limit int) (listResponse, bool) {
	key := cacheKey(tenantID, entityType, status, cursor, limit)
	s.cacheMu.RLock()
	item, ok := s.listCache[key]
	s.cacheMu.RUnlock()
	if !ok || time.Now().After(item.Expires) {
		return listResponse{}, false
	}
	return item.Response, true
}

func (s *service) setListCache(tenantID, entityType, status, cursor string, limit int, value listResponse) {
	key := cacheKey(tenantID, entityType, status, cursor, limit)
	s.cacheMu.Lock()
	s.listCache[key] = cacheItem{Response: value, Expires: time.Now().Add(s.cacheTTL)}
	s.cacheMu.Unlock()
}

func (s *service) invalidateTenantCache(tenantID string) {
	if tenantID == "" {
		return
	}
	prefix := tenantID + "|"
	s.cacheMu.Lock()
	for k := range s.listCache {
		if strings.HasPrefix(k, prefix) {
			delete(s.listCache, k)
		}
	}
	s.cacheMu.Unlock()
}

func cacheKey(tenantID, entityType, status, cursor string, limit int) string {
	return fmt.Sprintf("%s|%s|%s|%s|%d", tenantID, entityType, normalizeStatus(status), cursor, limit)
}

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

func parseCursor(cursor string) (time.Time, string, error) {
	if cursor == "" {
		return time.Time{}, "", nil
	}
	parts := strings.SplitN(cursor, ":", 2)
	if len(parts) != 2 {
		return time.Time{}, "", errors.New("invalid cursor format")
	}
	n, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return time.Time{}, "", errors.New("invalid cursor timestamp")
	}
	if parts[1] == "" {
		return time.Time{}, "", errors.New("invalid cursor id")
	}
	return time.Unix(0, n).UTC(), parts[1], nil
}

func encodeCursor(ts time.Time, id string) string {
	return fmt.Sprintf("%d:%s", ts.UTC().UnixNano(), id)
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

func withServerDefaults(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

func decodeJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(string(body))) == 0 {
		return errors.New("empty request body")
	}
	if err := json.Unmarshal(body, v); err != nil {
		return errors.New("invalid JSON payload")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func intParam(r *http.Request, key string, def, min, max int) int {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	if n < min {
		return min
	}
	if n > max {
		return max
	}
	return n
}

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

func env(key, def string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	return v
}

func intEnv(key string, def int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return n
}

func durationEnv(key string, def time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	d, err := time.ParseDuration(raw)
	if err != nil {
		return def
	}
	return d
}

func newID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("si_%d", time.Now().UnixNano())
	}
	return "si_" + hex.EncodeToString(buf)
}
