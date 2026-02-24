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

type storefront struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Domain      string    `json:"domain,omitempty"`
	ThemeID     string    `json:"theme_id,omitempty"`
	LogoURL     string    `json:"logo_url,omitempty"`
	FaviconURL  string    `json:"favicon_url,omitempty"`
	Description string    `json:"description,omitempty"`
	Currency    string    `json:"currency"`
	Locale      string    `json:"locale"`
	Status      string    `json:"status"`
	ConfigJSON  string    `json:"config_json,omitempty"`
	SEOJSON     string    `json:"seo_json,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type createStorefrontRequest struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Domain      string `json:"domain"`
	ThemeID     string `json:"theme_id"`
	LogoURL     string `json:"logo_url"`
	FaviconURL  string `json:"favicon_url"`
	Description string `json:"description"`
	Currency    string `json:"currency"`
	Locale      string `json:"locale"`
	Status      string `json:"status"`
	ConfigJSON  string `json:"config_json"`
	SEOJSON     string `json:"seo_json"`
}

type updateStorefrontRequest struct {
	Name        *string `json:"name,omitempty"`
	Slug        *string `json:"slug,omitempty"`
	Domain      *string `json:"domain,omitempty"`
	ThemeID     *string `json:"theme_id,omitempty"`
	LogoURL     *string `json:"logo_url,omitempty"`
	FaviconURL  *string `json:"favicon_url,omitempty"`
	Description *string `json:"description,omitempty"`
	Currency    *string `json:"currency,omitempty"`
	Locale      *string `json:"locale,omitempty"`
	Status      *string `json:"status,omitempty"`
	ConfigJSON  *string `json:"config_json,omitempty"`
	SEOJSON     *string `json:"seo_json,omitempty"`
}

type listResponse struct {
	Items      []storefront `json:"items"`
	NextCursor string       `json:"next_cursor,omitempty"`
	Cached     bool         `json:"cached"`
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
	memByID   map[string]storefront
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
		memByID:   make(map[string]storefront),
	}

	if db, err := connectDB(); err != nil {
		log.Printf("warn: database unavailable, running storefront in memory mode: %v", err)
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
		writeJSON(w, http.StatusOK, map[string]any{"status": "healthy", "module": module, "service": "storefront-service", "mode": mode})
	})

	base := "/v1/storefronts"

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
		status := strings.TrimSpace(r.URL.Query().Get("status"))
		plan, err := svc.explainList(r.Context(), tenantID, status)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"plan": plan, "event_topic": "erp.ecommerce.storefront.explain.generated"})
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
			status := strings.TrimSpace(r.URL.Query().Get("status"))
			resp, err := svc.listStorefronts(r.Context(), tenantID, status, cursor, limit)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": resp.Items, "next_cursor": resp.NextCursor, "cached": resp.Cached, "event_topic": "erp.ecommerce.storefront.listed"})
		case http.MethodPost:
			var req createStorefrontRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			sf, err := buildCreateStorefront(tenantID, req)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			if err := svc.createStorefront(r.Context(), sf); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"item": sf, "event_topic": "erp.ecommerce.storefront.created"})
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
			sf, err := svc.getByID(r.Context(), tenantID, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "storefront not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": sf, "event_topic": "erp.ecommerce.storefront.read"})
		case http.MethodPut, http.MethodPatch:
			var req updateStorefrontRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			updated, err := svc.updateStorefront(r.Context(), tenantID, id, req)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "storefront not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": updated, "event_topic": "erp.ecommerce.storefront.updated"})
		case http.MethodDelete:
			if err := svc.deleteStorefront(r.Context(), tenantID, id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "storefront not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "event_topic": "erp.ecommerce.storefront.deleted"})
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

	log.Printf("storefront-service listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}

// ---------------------------------------------------------------------------
// Build / Validate
// ---------------------------------------------------------------------------

func buildCreateStorefront(tenantID string, req createStorefrontRequest) (storefront, error) {
	if strings.TrimSpace(req.Name) == "" {
		return storefront{}, errors.New("name is required")
	}
	if strings.TrimSpace(req.Slug) == "" {
		return storefront{}, errors.New("slug is required")
	}
	status := normalizeStatus(req.Status)
	if status == "" {
		status = "coming_soon"
	}
	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "USD"
	}
	locale := strings.TrimSpace(req.Locale)
	if locale == "" {
		locale = "en"
	}
	now := time.Now().UTC()
	return storefront{
		ID:          newID(),
		TenantID:    tenantID,
		Name:        strings.TrimSpace(req.Name),
		Slug:        strings.TrimSpace(req.Slug),
		Domain:      strings.TrimSpace(req.Domain),
		ThemeID:     strings.TrimSpace(req.ThemeID),
		LogoURL:     strings.TrimSpace(req.LogoURL),
		FaviconURL:  strings.TrimSpace(req.FaviconURL),
		Description: strings.TrimSpace(req.Description),
		Currency:    currency,
		Locale:      locale,
		Status:      status,
		ConfigJSON:  req.ConfigJSON,
		SEOJSON:     req.SEOJSON,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func normalizeStatus(status string) string {
	s := strings.ToLower(strings.TrimSpace(status))
	switch s {
	case "active", "inactive", "maintenance", "coming_soon":
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
		`CREATE TABLE IF NOT EXISTS ecommerce_storefronts (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			name TEXT NOT NULL,
			slug TEXT NOT NULL,
			domain TEXT,
			theme_id TEXT,
			logo_url TEXT,
			favicon_url TEXT,
			description TEXT,
			currency TEXT DEFAULT 'USD',
			locale TEXT DEFAULT 'en',
			status TEXT CHECK (status IN ('active','inactive','maintenance','coming_soon')) DEFAULT 'coming_soon',
			config_json TEXT,
			seo_json TEXT,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_storefronts_tenant_created ON ecommerce_storefronts (tenant_id, created_at DESC, id DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_storefronts_tenant_status ON ecommerce_storefronts (tenant_id, status)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_storefronts_tenant_slug ON ecommerce_storefronts (tenant_id, slug)`,
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

func (s *service) createStorefront(ctx context.Context, sf storefront) error {
	if s.db == nil {
		s.memMu.Lock()
		s.memByID[sf.ID] = sf
		s.memMu.Unlock()
		s.invalidateTenantCache(sf.TenantID)
		return nil
	}
	q := `INSERT INTO ecommerce_storefronts (id, tenant_id, name, slug, domain, theme_id, logo_url, favicon_url, description, currency, locale, status, config_json, seo_json, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`
	if _, err := s.db.ExecContext(ctx, q,
		sf.ID, sf.TenantID, sf.Name, sf.Slug, nilIfEmpty(sf.Domain), nilIfEmpty(sf.ThemeID),
		nilIfEmpty(sf.LogoURL), nilIfEmpty(sf.FaviconURL), nilIfEmpty(sf.Description),
		sf.Currency, sf.Locale, sf.Status, nilIfEmpty(sf.ConfigJSON), nilIfEmpty(sf.SEOJSON),
		sf.CreatedAt, sf.UpdatedAt,
	); err != nil {
		return err
	}
	s.invalidateTenantCache(sf.TenantID)
	return nil
}

// ---------------------------------------------------------------------------
// CRUD - Read
// ---------------------------------------------------------------------------

func (s *service) getByID(ctx context.Context, tenantID, id string) (storefront, error) {
	if s.db == nil {
		s.memMu.RLock()
		sf, ok := s.memByID[id]
		s.memMu.RUnlock()
		if !ok || sf.TenantID != tenantID {
			return storefront{}, sql.ErrNoRows
		}
		return sf, nil
	}

	q := `SELECT id, tenant_id, name, slug, domain, theme_id, logo_url, favicon_url, description, currency, locale, status, config_json, seo_json, created_at, updated_at
		FROM ecommerce_storefronts WHERE tenant_id=$1 AND id=$2`
	var sf storefront
	var domain, themeID, logoURL, faviconURL, desc, configJSON, seoJSON sql.NullString
	err := s.db.QueryRowContext(ctx, q, tenantID, id).Scan(
		&sf.ID, &sf.TenantID, &sf.Name, &sf.Slug, &domain, &themeID,
		&logoURL, &faviconURL, &desc, &sf.Currency, &sf.Locale, &sf.Status,
		&configJSON, &seoJSON, &sf.CreatedAt, &sf.UpdatedAt,
	)
	if err != nil {
		return storefront{}, err
	}
	sf.Domain = domain.String
	sf.ThemeID = themeID.String
	sf.LogoURL = logoURL.String
	sf.FaviconURL = faviconURL.String
	sf.Description = desc.String
	sf.ConfigJSON = configJSON.String
	sf.SEOJSON = seoJSON.String
	return sf, nil
}

// ---------------------------------------------------------------------------
// CRUD - List
// ---------------------------------------------------------------------------

func (s *service) listStorefronts(ctx context.Context, tenantID, status, cursor string, limit int) (listResponse, error) {
	if cursor == "" {
		if cached, ok := s.getListCache(tenantID, status, cursor, limit); ok {
			cached.Cached = true
			return cached, nil
		}
	}

	if s.db == nil {
		resp := s.listStorefrontsMemory(tenantID, status, cursor, limit)
		if cursor == "" {
			s.setListCache(tenantID, status, cursor, limit, resp)
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
		SELECT id, tenant_id, name, slug, domain, theme_id, logo_url, favicon_url, description, currency, locale, status, config_json, seo_json, created_at, updated_at
		FROM ecommerce_storefronts
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), nextArg)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return listResponse{}, err
	}
	defer rows.Close()

	items := make([]storefront, 0, limit)
	for rows.Next() {
		var sf storefront
		var dom, tid, lu, fu, dsc, cj, sj sql.NullString
		if err := rows.Scan(&sf.ID, &sf.TenantID, &sf.Name, &sf.Slug, &dom, &tid, &lu, &fu, &dsc, &sf.Currency, &sf.Locale, &sf.Status, &cj, &sj, &sf.CreatedAt, &sf.UpdatedAt); err != nil {
			return listResponse{}, err
		}
		sf.Domain = dom.String
		sf.ThemeID = tid.String
		sf.LogoURL = lu.String
		sf.FaviconURL = fu.String
		sf.Description = dsc.String
		sf.ConfigJSON = cj.String
		sf.SEOJSON = sj.String
		items = append(items, sf)
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
		s.setListCache(tenantID, status, cursor, limit, resp)
	}
	return resp, nil
}

func (s *service) listStorefrontsMemory(tenantID, status, cursor string, limit int) listResponse {
	s.memMu.RLock()
	items := make([]storefront, 0)
	for _, sf := range s.memByID {
		if sf.TenantID != tenantID {
			continue
		}
		if status != "" && sf.Status != normalizeStatus(status) {
			continue
		}
		items = append(items, sf)
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

func (s *service) updateStorefront(ctx context.Context, tenantID, id string, req updateStorefrontRequest) (storefront, error) {
	if req.Name == nil && req.Slug == nil && req.Domain == nil && req.ThemeID == nil &&
		req.LogoURL == nil && req.FaviconURL == nil && req.Description == nil &&
		req.Currency == nil && req.Locale == nil && req.Status == nil &&
		req.ConfigJSON == nil && req.SEOJSON == nil {
		return storefront{}, errors.New("empty update payload")
	}

	if s.db == nil {
		s.memMu.Lock()
		sf, ok := s.memByID[id]
		if !ok || sf.TenantID != tenantID {
			s.memMu.Unlock()
			return storefront{}, sql.ErrNoRows
		}
		if req.Name != nil {
			sf.Name = strings.TrimSpace(*req.Name)
		}
		if req.Slug != nil {
			sf.Slug = strings.TrimSpace(*req.Slug)
		}
		if req.Domain != nil {
			sf.Domain = strings.TrimSpace(*req.Domain)
		}
		if req.ThemeID != nil {
			sf.ThemeID = strings.TrimSpace(*req.ThemeID)
		}
		if req.LogoURL != nil {
			sf.LogoURL = strings.TrimSpace(*req.LogoURL)
		}
		if req.FaviconURL != nil {
			sf.FaviconURL = strings.TrimSpace(*req.FaviconURL)
		}
		if req.Description != nil {
			sf.Description = strings.TrimSpace(*req.Description)
		}
		if req.Currency != nil {
			sf.Currency = strings.ToUpper(strings.TrimSpace(*req.Currency))
		}
		if req.Locale != nil {
			sf.Locale = strings.TrimSpace(*req.Locale)
		}
		if req.Status != nil {
			ns := normalizeStatus(*req.Status)
			if ns == "" {
				s.memMu.Unlock()
				return storefront{}, errors.New("invalid status")
			}
			sf.Status = ns
		}
		if req.ConfigJSON != nil {
			sf.ConfigJSON = *req.ConfigJSON
		}
		if req.SEOJSON != nil {
			sf.SEOJSON = *req.SEOJSON
		}
		sf.UpdatedAt = time.Now().UTC()
		s.memByID[id] = sf
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return sf, nil
	}

	assignments := make([]string, 0, 13)
	args := []any{tenantID, id}
	next := 3
	if req.Name != nil {
		assignments = append(assignments, fmt.Sprintf("name = $%d", next))
		args = append(args, strings.TrimSpace(*req.Name))
		next++
	}
	if req.Slug != nil {
		assignments = append(assignments, fmt.Sprintf("slug = $%d", next))
		args = append(args, strings.TrimSpace(*req.Slug))
		next++
	}
	if req.Domain != nil {
		assignments = append(assignments, fmt.Sprintf("domain = $%d", next))
		args = append(args, strings.TrimSpace(*req.Domain))
		next++
	}
	if req.ThemeID != nil {
		assignments = append(assignments, fmt.Sprintf("theme_id = $%d", next))
		args = append(args, strings.TrimSpace(*req.ThemeID))
		next++
	}
	if req.LogoURL != nil {
		assignments = append(assignments, fmt.Sprintf("logo_url = $%d", next))
		args = append(args, strings.TrimSpace(*req.LogoURL))
		next++
	}
	if req.FaviconURL != nil {
		assignments = append(assignments, fmt.Sprintf("favicon_url = $%d", next))
		args = append(args, strings.TrimSpace(*req.FaviconURL))
		next++
	}
	if req.Description != nil {
		assignments = append(assignments, fmt.Sprintf("description = $%d", next))
		args = append(args, strings.TrimSpace(*req.Description))
		next++
	}
	if req.Currency != nil {
		assignments = append(assignments, fmt.Sprintf("currency = $%d", next))
		args = append(args, strings.ToUpper(strings.TrimSpace(*req.Currency)))
		next++
	}
	if req.Locale != nil {
		assignments = append(assignments, fmt.Sprintf("locale = $%d", next))
		args = append(args, strings.TrimSpace(*req.Locale))
		next++
	}
	if req.Status != nil {
		ns := normalizeStatus(*req.Status)
		if ns == "" {
			return storefront{}, errors.New("invalid status")
		}
		assignments = append(assignments, fmt.Sprintf("status = $%d", next))
		args = append(args, ns)
		next++
	}
	if req.ConfigJSON != nil {
		assignments = append(assignments, fmt.Sprintf("config_json = $%d", next))
		args = append(args, *req.ConfigJSON)
		next++
	}
	if req.SEOJSON != nil {
		assignments = append(assignments, fmt.Sprintf("seo_json = $%d", next))
		args = append(args, *req.SEOJSON)
		next++
	}

	assignments = append(assignments, fmt.Sprintf("updated_at = $%d", next))
	args = append(args, time.Now().UTC())

	q := fmt.Sprintf(`UPDATE ecommerce_storefronts SET %s WHERE tenant_id = $1 AND id = $2`, strings.Join(assignments, ", "))
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return storefront{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return storefront{}, err
	}
	if affected == 0 {
		return storefront{}, sql.ErrNoRows
	}
	s.invalidateTenantCache(tenantID)
	return s.getByID(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// CRUD - Delete
// ---------------------------------------------------------------------------

func (s *service) deleteStorefront(ctx context.Context, tenantID, id string) error {
	if s.db == nil {
		s.memMu.Lock()
		sf, ok := s.memByID[id]
		if !ok || sf.TenantID != tenantID {
			s.memMu.Unlock()
			return sql.ErrNoRows
		}
		delete(s.memByID, id)
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return nil
	}

	res, err := s.db.ExecContext(ctx, `DELETE FROM ecommerce_storefronts WHERE tenant_id=$1 AND id=$2`, tenantID, id)
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

func (s *service) explainList(ctx context.Context, tenantID, status string) (any, error) {
	if s.db == nil {
		return map[string]any{"mode": "memory", "note": "no SQL plan available"}, nil
	}

	args := []any{tenantID}
	where := []string{"tenant_id = $1"}
	nextArg := 2
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	planQuery := fmt.Sprintf(`EXPLAIN (ANALYZE FALSE, FORMAT JSON)
		SELECT id, tenant_id, name, slug, domain, theme_id, logo_url, favicon_url, description, currency, locale, status, config_json, seo_json, created_at, updated_at
		FROM ecommerce_storefronts
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

func (s *service) getListCache(tenantID, status, cursor string, limit int) (listResponse, bool) {
	key := cacheKey(tenantID, status, cursor, limit)
	s.cacheMu.RLock()
	item, ok := s.listCache[key]
	s.cacheMu.RUnlock()
	if !ok || time.Now().After(item.Expires) {
		return listResponse{}, false
	}
	return item.Response, true
}

func (s *service) setListCache(tenantID, status, cursor string, limit int, value listResponse) {
	key := cacheKey(tenantID, status, cursor, limit)
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

func cacheKey(tenantID, status, cursor string, limit int) string {
	return fmt.Sprintf("%s|%s|%s|%d", tenantID, normalizeStatus(status), cursor, limit)
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
		return fmt.Sprintf("sf_%d", time.Now().UnixNano())
	}
	return "sf_" + hex.EncodeToString(buf)
}
