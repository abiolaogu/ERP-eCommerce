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

type theme struct {
	ID             string    `json:"id"`
	TenantID       string    `json:"tenant_id"`
	Name           string    `json:"name"`
	Description    string    `json:"description,omitempty"`
	Author         string    `json:"author,omitempty"`
	Version        string    `json:"version"`
	PreviewURL     string    `json:"preview_url,omitempty"`
	ThumbnailURL   string    `json:"thumbnail_url,omitempty"`
	Category       string    `json:"category,omitempty"`
	ColorsJSON     string    `json:"colors_json,omitempty"`
	TypographyJSON string    `json:"typography_json,omitempty"`
	LayoutJSON     string    `json:"layout_json,omitempty"`
	Status         string    `json:"status"`
	IsDefault      bool      `json:"is_default"`
	InstallCount   int       `json:"install_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type createThemeRequest struct {
	Name           string `json:"name"`
	Description    string `json:"description"`
	Author         string `json:"author"`
	Version        string `json:"version"`
	PreviewURL     string `json:"preview_url"`
	ThumbnailURL   string `json:"thumbnail_url"`
	Category       string `json:"category"`
	ColorsJSON     string `json:"colors_json"`
	TypographyJSON string `json:"typography_json"`
	LayoutJSON     string `json:"layout_json"`
	Status         string `json:"status"`
	IsDefault      bool   `json:"is_default"`
}

type updateThemeRequest struct {
	Name           *string `json:"name,omitempty"`
	Description    *string `json:"description,omitempty"`
	Author         *string `json:"author,omitempty"`
	Version        *string `json:"version,omitempty"`
	PreviewURL     *string `json:"preview_url,omitempty"`
	ThumbnailURL   *string `json:"thumbnail_url,omitempty"`
	Category       *string `json:"category,omitempty"`
	ColorsJSON     *string `json:"colors_json,omitempty"`
	TypographyJSON *string `json:"typography_json,omitempty"`
	LayoutJSON     *string `json:"layout_json,omitempty"`
	Status         *string `json:"status,omitempty"`
	IsDefault      *bool   `json:"is_default,omitempty"`
	InstallCount   *int    `json:"install_count,omitempty"`
}

type listResponse struct {
	Items      []theme `json:"items"`
	NextCursor string  `json:"next_cursor,omitempty"`
	Cached     bool    `json:"cached"`
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
	memByID   map[string]theme
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
		memByID:   make(map[string]theme),
	}

	if db, err := connectDB(); err != nil {
		log.Printf("warn: database unavailable, running theme in memory mode: %v", err)
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
		writeJSON(w, http.StatusOK, map[string]any{"status": "healthy", "module": module, "service": "theme-service", "mode": mode})
	})

	base := "/v1/themes"

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
		category := strings.TrimSpace(r.URL.Query().Get("category"))
		status := strings.TrimSpace(r.URL.Query().Get("status"))
		author := strings.TrimSpace(r.URL.Query().Get("author"))
		plan, err := svc.explainList(r.Context(), tenantID, category, status, author)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"plan": plan, "event_topic": "erp.ecommerce.theme.explain.generated"})
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
			category := strings.TrimSpace(r.URL.Query().Get("category"))
			status := strings.TrimSpace(r.URL.Query().Get("status"))
			author := strings.TrimSpace(r.URL.Query().Get("author"))
			resp, err := svc.listThemes(r.Context(), tenantID, category, status, author, cursor, limit)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": resp.Items, "next_cursor": resp.NextCursor, "cached": resp.Cached, "event_topic": "erp.ecommerce.theme.listed"})
		case http.MethodPost:
			var req createThemeRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			th, err := buildCreateTheme(tenantID, req)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			if err := svc.createTheme(r.Context(), th); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"item": th, "event_topic": "erp.ecommerce.theme.created"})
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
			th, err := svc.getByID(r.Context(), tenantID, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "theme not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": th, "event_topic": "erp.ecommerce.theme.read"})
		case http.MethodPut, http.MethodPatch:
			var req updateThemeRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			updated, err := svc.updateTheme(r.Context(), tenantID, id, req)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "theme not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": updated, "event_topic": "erp.ecommerce.theme.updated"})
		case http.MethodDelete:
			if err := svc.deleteTheme(r.Context(), tenantID, id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "theme not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "event_topic": "erp.ecommerce.theme.deleted"})
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

	log.Printf("theme-service listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}

// ---------------------------------------------------------------------------
// Build / Validate
// ---------------------------------------------------------------------------

func buildCreateTheme(tenantID string, req createThemeRequest) (theme, error) {
	if strings.TrimSpace(req.Name) == "" {
		return theme{}, errors.New("name is required")
	}
	status := normalizeStatus(req.Status)
	if status == "" {
		status = "draft"
	}
	version := strings.TrimSpace(req.Version)
	if version == "" {
		version = "1.0.0"
	}
	now := time.Now().UTC()
	return theme{
		ID:             newID(),
		TenantID:       tenantID,
		Name:           strings.TrimSpace(req.Name),
		Description:    strings.TrimSpace(req.Description),
		Author:         strings.TrimSpace(req.Author),
		Version:        version,
		PreviewURL:     strings.TrimSpace(req.PreviewURL),
		ThumbnailURL:   strings.TrimSpace(req.ThumbnailURL),
		Category:       strings.TrimSpace(req.Category),
		ColorsJSON:     req.ColorsJSON,
		TypographyJSON: req.TypographyJSON,
		LayoutJSON:     req.LayoutJSON,
		Status:         status,
		IsDefault:      req.IsDefault,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

func normalizeStatus(status string) string {
	s := strings.ToLower(strings.TrimSpace(status))
	switch s {
	case "active", "inactive", "draft":
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
		`CREATE TABLE IF NOT EXISTS ecommerce_themes (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			author TEXT,
			version TEXT DEFAULT '1.0.0',
			preview_url TEXT,
			thumbnail_url TEXT,
			category TEXT,
			colors_json TEXT,
			typography_json TEXT,
			layout_json TEXT,
			status TEXT CHECK (status IN ('active','inactive','draft')) DEFAULT 'draft',
			is_default BOOLEAN DEFAULT false,
			install_count INT DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_themes_tenant_created ON ecommerce_themes (tenant_id, created_at DESC, id DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_themes_tenant_category ON ecommerce_themes (tenant_id, category)`,
		`CREATE INDEX IF NOT EXISTS idx_themes_tenant_status ON ecommerce_themes (tenant_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_themes_tenant_author ON ecommerce_themes (tenant_id, author)`,
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

func (s *service) createTheme(ctx context.Context, th theme) error {
	if s.db == nil {
		s.memMu.Lock()
		s.memByID[th.ID] = th
		s.memMu.Unlock()
		s.invalidateTenantCache(th.TenantID)
		return nil
	}
	q := `INSERT INTO ecommerce_themes (id, tenant_id, name, description, author, version, preview_url, thumbnail_url, category, colors_json, typography_json, layout_json, status, is_default, install_count, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`
	if _, err := s.db.ExecContext(ctx, q,
		th.ID, th.TenantID, th.Name, nilIfEmpty(th.Description), nilIfEmpty(th.Author),
		th.Version, nilIfEmpty(th.PreviewURL), nilIfEmpty(th.ThumbnailURL), nilIfEmpty(th.Category),
		nilIfEmpty(th.ColorsJSON), nilIfEmpty(th.TypographyJSON), nilIfEmpty(th.LayoutJSON),
		th.Status, th.IsDefault, th.InstallCount, th.CreatedAt, th.UpdatedAt,
	); err != nil {
		return err
	}
	s.invalidateTenantCache(th.TenantID)
	return nil
}

// ---------------------------------------------------------------------------
// CRUD - Read
// ---------------------------------------------------------------------------

func (s *service) getByID(ctx context.Context, tenantID, id string) (theme, error) {
	if s.db == nil {
		s.memMu.RLock()
		th, ok := s.memByID[id]
		s.memMu.RUnlock()
		if !ok || th.TenantID != tenantID {
			return theme{}, sql.ErrNoRows
		}
		return th, nil
	}

	q := `SELECT id, tenant_id, name, description, author, version, preview_url, thumbnail_url, category, colors_json, typography_json, layout_json, status, is_default, install_count, created_at, updated_at
		FROM ecommerce_themes WHERE tenant_id=$1 AND id=$2`
	var th theme
	var desc, author, prevURL, thumbURL, cat, colJSON, typJSON, layJSON sql.NullString
	err := s.db.QueryRowContext(ctx, q, tenantID, id).Scan(
		&th.ID, &th.TenantID, &th.Name, &desc, &author, &th.Version,
		&prevURL, &thumbURL, &cat, &colJSON, &typJSON, &layJSON,
		&th.Status, &th.IsDefault, &th.InstallCount, &th.CreatedAt, &th.UpdatedAt,
	)
	if err != nil {
		return theme{}, err
	}
	th.Description = desc.String
	th.Author = author.String
	th.PreviewURL = prevURL.String
	th.ThumbnailURL = thumbURL.String
	th.Category = cat.String
	th.ColorsJSON = colJSON.String
	th.TypographyJSON = typJSON.String
	th.LayoutJSON = layJSON.String
	return th, nil
}

// ---------------------------------------------------------------------------
// CRUD - List
// ---------------------------------------------------------------------------

func (s *service) listThemes(ctx context.Context, tenantID, category, status, author, cursor string, limit int) (listResponse, error) {
	if cursor == "" {
		if cached, ok := s.getListCache(tenantID, category, status, author, cursor, limit); ok {
			cached.Cached = true
			return cached, nil
		}
	}

	if s.db == nil {
		resp := s.listThemesMemory(tenantID, category, status, author, cursor, limit)
		if cursor == "" {
			s.setListCache(tenantID, category, status, author, cursor, limit, resp)
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
	if category != "" {
		where = append(where, fmt.Sprintf("category = $%d", nextArg))
		args = append(args, category)
		nextArg++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	if author != "" {
		where = append(where, fmt.Sprintf("author = $%d", nextArg))
		args = append(args, author)
		nextArg++
	}
	if !cursorTime.IsZero() {
		where = append(where, fmt.Sprintf("(created_at, id) < ($%d, $%d)", nextArg, nextArg+1))
		args = append(args, cursorTime, cursorID)
		nextArg += 2
	}
	args = append(args, limit+1)
	q := fmt.Sprintf(`
		SELECT id, tenant_id, name, description, author, version, preview_url, thumbnail_url, category, colors_json, typography_json, layout_json, status, is_default, install_count, created_at, updated_at
		FROM ecommerce_themes
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), nextArg)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return listResponse{}, err
	}
	defer rows.Close()

	items := make([]theme, 0, limit)
	for rows.Next() {
		var th theme
		var dsc, au, pu, tu, ct, cj, tj, lj sql.NullString
		if err := rows.Scan(&th.ID, &th.TenantID, &th.Name, &dsc, &au, &th.Version,
			&pu, &tu, &ct, &cj, &tj, &lj,
			&th.Status, &th.IsDefault, &th.InstallCount, &th.CreatedAt, &th.UpdatedAt); err != nil {
			return listResponse{}, err
		}
		th.Description = dsc.String
		th.Author = au.String
		th.PreviewURL = pu.String
		th.ThumbnailURL = tu.String
		th.Category = ct.String
		th.ColorsJSON = cj.String
		th.TypographyJSON = tj.String
		th.LayoutJSON = lj.String
		items = append(items, th)
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
		s.setListCache(tenantID, category, status, author, cursor, limit, resp)
	}
	return resp, nil
}

func (s *service) listThemesMemory(tenantID, category, status, author, cursor string, limit int) listResponse {
	s.memMu.RLock()
	items := make([]theme, 0)
	for _, th := range s.memByID {
		if th.TenantID != tenantID {
			continue
		}
		if category != "" && th.Category != category {
			continue
		}
		if status != "" && th.Status != normalizeStatus(status) {
			continue
		}
		if author != "" && th.Author != author {
			continue
		}
		items = append(items, th)
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

func (s *service) updateTheme(ctx context.Context, tenantID, id string, req updateThemeRequest) (theme, error) {
	if req.Name == nil && req.Description == nil && req.Author == nil && req.Version == nil &&
		req.PreviewURL == nil && req.ThumbnailURL == nil && req.Category == nil &&
		req.ColorsJSON == nil && req.TypographyJSON == nil && req.LayoutJSON == nil &&
		req.Status == nil && req.IsDefault == nil && req.InstallCount == nil {
		return theme{}, errors.New("empty update payload")
	}

	if s.db == nil {
		s.memMu.Lock()
		th, ok := s.memByID[id]
		if !ok || th.TenantID != tenantID {
			s.memMu.Unlock()
			return theme{}, sql.ErrNoRows
		}
		if req.Name != nil {
			th.Name = strings.TrimSpace(*req.Name)
		}
		if req.Description != nil {
			th.Description = strings.TrimSpace(*req.Description)
		}
		if req.Author != nil {
			th.Author = strings.TrimSpace(*req.Author)
		}
		if req.Version != nil {
			th.Version = strings.TrimSpace(*req.Version)
		}
		if req.PreviewURL != nil {
			th.PreviewURL = strings.TrimSpace(*req.PreviewURL)
		}
		if req.ThumbnailURL != nil {
			th.ThumbnailURL = strings.TrimSpace(*req.ThumbnailURL)
		}
		if req.Category != nil {
			th.Category = strings.TrimSpace(*req.Category)
		}
		if req.ColorsJSON != nil {
			th.ColorsJSON = *req.ColorsJSON
		}
		if req.TypographyJSON != nil {
			th.TypographyJSON = *req.TypographyJSON
		}
		if req.LayoutJSON != nil {
			th.LayoutJSON = *req.LayoutJSON
		}
		if req.Status != nil {
			ns := normalizeStatus(*req.Status)
			if ns == "" {
				s.memMu.Unlock()
				return theme{}, errors.New("invalid status")
			}
			th.Status = ns
		}
		if req.IsDefault != nil {
			th.IsDefault = *req.IsDefault
		}
		if req.InstallCount != nil {
			th.InstallCount = *req.InstallCount
		}
		th.UpdatedAt = time.Now().UTC()
		s.memByID[id] = th
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return th, nil
	}

	assignments := make([]string, 0, 14)
	args := []any{tenantID, id}
	next := 3
	if req.Name != nil {
		assignments = append(assignments, fmt.Sprintf("name = $%d", next))
		args = append(args, strings.TrimSpace(*req.Name))
		next++
	}
	if req.Description != nil {
		assignments = append(assignments, fmt.Sprintf("description = $%d", next))
		args = append(args, strings.TrimSpace(*req.Description))
		next++
	}
	if req.Author != nil {
		assignments = append(assignments, fmt.Sprintf("author = $%d", next))
		args = append(args, strings.TrimSpace(*req.Author))
		next++
	}
	if req.Version != nil {
		assignments = append(assignments, fmt.Sprintf("version = $%d", next))
		args = append(args, strings.TrimSpace(*req.Version))
		next++
	}
	if req.PreviewURL != nil {
		assignments = append(assignments, fmt.Sprintf("preview_url = $%d", next))
		args = append(args, strings.TrimSpace(*req.PreviewURL))
		next++
	}
	if req.ThumbnailURL != nil {
		assignments = append(assignments, fmt.Sprintf("thumbnail_url = $%d", next))
		args = append(args, strings.TrimSpace(*req.ThumbnailURL))
		next++
	}
	if req.Category != nil {
		assignments = append(assignments, fmt.Sprintf("category = $%d", next))
		args = append(args, strings.TrimSpace(*req.Category))
		next++
	}
	if req.ColorsJSON != nil {
		assignments = append(assignments, fmt.Sprintf("colors_json = $%d", next))
		args = append(args, *req.ColorsJSON)
		next++
	}
	if req.TypographyJSON != nil {
		assignments = append(assignments, fmt.Sprintf("typography_json = $%d", next))
		args = append(args, *req.TypographyJSON)
		next++
	}
	if req.LayoutJSON != nil {
		assignments = append(assignments, fmt.Sprintf("layout_json = $%d", next))
		args = append(args, *req.LayoutJSON)
		next++
	}
	if req.Status != nil {
		ns := normalizeStatus(*req.Status)
		if ns == "" {
			return theme{}, errors.New("invalid status")
		}
		assignments = append(assignments, fmt.Sprintf("status = $%d", next))
		args = append(args, ns)
		next++
	}
	if req.IsDefault != nil {
		assignments = append(assignments, fmt.Sprintf("is_default = $%d", next))
		args = append(args, *req.IsDefault)
		next++
	}
	if req.InstallCount != nil {
		assignments = append(assignments, fmt.Sprintf("install_count = $%d", next))
		args = append(args, *req.InstallCount)
		next++
	}

	assignments = append(assignments, fmt.Sprintf("updated_at = $%d", next))
	args = append(args, time.Now().UTC())

	q := fmt.Sprintf(`UPDATE ecommerce_themes SET %s WHERE tenant_id = $1 AND id = $2`, strings.Join(assignments, ", "))
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return theme{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return theme{}, err
	}
	if affected == 0 {
		return theme{}, sql.ErrNoRows
	}
	s.invalidateTenantCache(tenantID)
	return s.getByID(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// CRUD - Delete
// ---------------------------------------------------------------------------

func (s *service) deleteTheme(ctx context.Context, tenantID, id string) error {
	if s.db == nil {
		s.memMu.Lock()
		th, ok := s.memByID[id]
		if !ok || th.TenantID != tenantID {
			s.memMu.Unlock()
			return sql.ErrNoRows
		}
		delete(s.memByID, id)
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return nil
	}

	res, err := s.db.ExecContext(ctx, `DELETE FROM ecommerce_themes WHERE tenant_id=$1 AND id=$2`, tenantID, id)
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

func (s *service) explainList(ctx context.Context, tenantID, category, status, author string) (any, error) {
	if s.db == nil {
		return map[string]any{"mode": "memory", "note": "no SQL plan available"}, nil
	}

	args := []any{tenantID}
	where := []string{"tenant_id = $1"}
	nextArg := 2
	if category != "" {
		where = append(where, fmt.Sprintf("category = $%d", nextArg))
		args = append(args, category)
		nextArg++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	if author != "" {
		where = append(where, fmt.Sprintf("author = $%d", nextArg))
		args = append(args, author)
		nextArg++
	}
	planQuery := fmt.Sprintf(`EXPLAIN (ANALYZE FALSE, FORMAT JSON)
		SELECT id, tenant_id, name, description, author, version, preview_url, thumbnail_url, category, colors_json, typography_json, layout_json, status, is_default, install_count, created_at, updated_at
		FROM ecommerce_themes
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

func (s *service) getListCache(tenantID, category, status, author, cursor string, limit int) (listResponse, bool) {
	key := cacheKey(tenantID, category, status, author, cursor, limit)
	s.cacheMu.RLock()
	item, ok := s.listCache[key]
	s.cacheMu.RUnlock()
	if !ok || time.Now().After(item.Expires) {
		return listResponse{}, false
	}
	return item.Response, true
}

func (s *service) setListCache(tenantID, category, status, author, cursor string, limit int, value listResponse) {
	key := cacheKey(tenantID, category, status, author, cursor, limit)
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

func cacheKey(tenantID, category, status, author, cursor string, limit int) string {
	return fmt.Sprintf("%s|%s|%s|%s|%s|%d", tenantID, category, normalizeStatus(status), author, cursor, limit)
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
		return fmt.Sprintf("thm_%d", time.Now().UnixNano())
	}
	return "thm_" + hex.EncodeToString(buf)
}
