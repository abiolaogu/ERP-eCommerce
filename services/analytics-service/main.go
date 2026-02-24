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

type analyticsEvent struct {
	ID             string    `json:"id"`
	TenantID       string    `json:"tenant_id"`
	EventType      string    `json:"event_type"`
	SessionID      string    `json:"session_id,omitempty"`
	UserID         string    `json:"user_id,omitempty"`
	PageURL        string    `json:"page_url,omitempty"`
	Referrer       string    `json:"referrer,omitempty"`
	DeviceType     string    `json:"device_type,omitempty"`
	Browser        string    `json:"browser,omitempty"`
	Country        string    `json:"country,omitempty"`
	PropertiesJSON string    `json:"properties_json,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type createAnalyticsEventRequest struct {
	EventType      string `json:"event_type"`
	SessionID      string `json:"session_id"`
	UserID         string `json:"user_id"`
	PageURL        string `json:"page_url"`
	Referrer       string `json:"referrer"`
	DeviceType     string `json:"device_type"`
	Browser        string `json:"browser"`
	Country        string `json:"country"`
	PropertiesJSON string `json:"properties_json"`
}

type listResponse struct {
	Items      []analyticsEvent `json:"items"`
	NextCursor string           `json:"next_cursor,omitempty"`
	Cached     bool             `json:"cached"`
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
	memByID   map[string]analyticsEvent
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
		memByID:   make(map[string]analyticsEvent),
	}

	if db, err := connectDB(); err != nil {
		log.Printf("warn: database unavailable, running analytics in memory mode: %v", err)
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
		writeJSON(w, http.StatusOK, map[string]any{"status": "healthy", "module": module, "service": "analytics-service", "mode": mode})
	})

	base := "/v1/analytics-events"

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
		eventType := strings.TrimSpace(r.URL.Query().Get("event_type"))
		sessionID := strings.TrimSpace(r.URL.Query().Get("session_id"))
		userID := strings.TrimSpace(r.URL.Query().Get("user_id"))
		plan, err := svc.explainList(r.Context(), tenantID, eventType, sessionID, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"plan": plan, "event_topic": "erp.ecommerce.analytics-event.explain.generated"})
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
			eventType := strings.TrimSpace(r.URL.Query().Get("event_type"))
			sessionID := strings.TrimSpace(r.URL.Query().Get("session_id"))
			userID := strings.TrimSpace(r.URL.Query().Get("user_id"))
			resp, err := svc.listEvents(r.Context(), tenantID, eventType, sessionID, userID, cursor, limit)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": resp.Items, "next_cursor": resp.NextCursor, "cached": resp.Cached, "event_topic": "erp.ecommerce.analytics-event.listed"})
		case http.MethodPost:
			var req createAnalyticsEventRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			evt, err := buildCreateEvent(tenantID, req)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			if err := svc.createEvent(r.Context(), evt); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"item": evt, "event_topic": "erp.ecommerce.analytics-event.created"})
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
			evt, err := svc.getByID(r.Context(), tenantID, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "analytics event not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": evt, "event_topic": "erp.ecommerce.analytics-event.read"})
		default:
			// Append-only: no update or delete
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

	log.Printf("analytics-service listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

func buildCreateEvent(tenantID string, req createAnalyticsEventRequest) (analyticsEvent, error) {
	if strings.TrimSpace(req.EventType) == "" {
		return analyticsEvent{}, errors.New("event_type is required")
	}
	now := time.Now().UTC()
	return analyticsEvent{
		ID:             newID(),
		TenantID:       tenantID,
		EventType:      strings.TrimSpace(req.EventType),
		SessionID:      strings.TrimSpace(req.SessionID),
		UserID:         strings.TrimSpace(req.UserID),
		PageURL:        strings.TrimSpace(req.PageURL),
		Referrer:       strings.TrimSpace(req.Referrer),
		DeviceType:     strings.TrimSpace(req.DeviceType),
		Browser:        strings.TrimSpace(req.Browser),
		Country:        strings.TrimSpace(req.Country),
		PropertiesJSON: req.PropertiesJSON,
		CreatedAt:      now,
	}, nil
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
		`CREATE TABLE IF NOT EXISTS ecommerce_analytics_events (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			event_type TEXT NOT NULL,
			session_id TEXT,
			user_id TEXT,
			page_url TEXT,
			referrer TEXT,
			device_type TEXT,
			browser TEXT,
			country TEXT,
			properties_json TEXT,
			created_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_created ON ecommerce_analytics_events (tenant_id, created_at DESC, id DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_event_type ON ecommerce_analytics_events (tenant_id, event_type)`,
		`CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_session ON ecommerce_analytics_events (tenant_id, session_id)`,
		`CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_user ON ecommerce_analytics_events (tenant_id, user_id)`,
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

func (s *service) createEvent(ctx context.Context, evt analyticsEvent) error {
	if s.db == nil {
		s.memMu.Lock()
		s.memByID[evt.ID] = evt
		s.memMu.Unlock()
		s.invalidateTenantCache(evt.TenantID)
		return nil
	}
	q := `INSERT INTO ecommerce_analytics_events (id, tenant_id, event_type, session_id, user_id, page_url, referrer, device_type, browser, country, properties_json, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`
	if _, err := s.db.ExecContext(ctx, q,
		evt.ID, evt.TenantID, evt.EventType, evt.SessionID, evt.UserID,
		evt.PageURL, evt.Referrer, evt.DeviceType, evt.Browser, evt.Country,
		evt.PropertiesJSON, evt.CreatedAt,
	); err != nil {
		return err
	}
	s.invalidateTenantCache(evt.TenantID)
	return nil
}

// ---------------------------------------------------------------------------
// CRUD - Read
// ---------------------------------------------------------------------------

func (s *service) getByID(ctx context.Context, tenantID, id string) (analyticsEvent, error) {
	if s.db == nil {
		s.memMu.RLock()
		evt, ok := s.memByID[id]
		s.memMu.RUnlock()
		if !ok || evt.TenantID != tenantID {
			return analyticsEvent{}, sql.ErrNoRows
		}
		return evt, nil
	}

	q := `SELECT id, tenant_id, event_type, session_id, user_id, page_url, referrer, device_type, browser, country, properties_json, created_at
		FROM ecommerce_analytics_events WHERE tenant_id=$1 AND id=$2`
	var evt analyticsEvent
	var sessionID, userID, pageURL, referrer, deviceType, browser, country, propsJSON sql.NullString
	err := s.db.QueryRowContext(ctx, q, tenantID, id).
		Scan(&evt.ID, &evt.TenantID, &evt.EventType, &sessionID, &userID, &pageURL, &referrer, &deviceType, &browser, &country, &propsJSON, &evt.CreatedAt)
	if err != nil {
		return analyticsEvent{}, err
	}
	evt.SessionID = sessionID.String
	evt.UserID = userID.String
	evt.PageURL = pageURL.String
	evt.Referrer = referrer.String
	evt.DeviceType = deviceType.String
	evt.Browser = browser.String
	evt.Country = country.String
	evt.PropertiesJSON = propsJSON.String
	return evt, nil
}

// ---------------------------------------------------------------------------
// CRUD - List
// ---------------------------------------------------------------------------

func (s *service) listEvents(ctx context.Context, tenantID, eventType, sessionID, userID, cursor string, limit int) (listResponse, error) {
	if cursor == "" {
		if cached, ok := s.getListCache(tenantID, eventType, sessionID, userID, cursor, limit); ok {
			cached.Cached = true
			return cached, nil
		}
	}

	if s.db == nil {
		resp := s.listEventsMemory(tenantID, eventType, sessionID, userID, cursor, limit)
		if cursor == "" {
			s.setListCache(tenantID, eventType, sessionID, userID, cursor, limit, resp)
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
	if eventType != "" {
		where = append(where, fmt.Sprintf("event_type = $%d", nextArg))
		args = append(args, eventType)
		nextArg++
	}
	if sessionID != "" {
		where = append(where, fmt.Sprintf("session_id = $%d", nextArg))
		args = append(args, sessionID)
		nextArg++
	}
	if userID != "" {
		where = append(where, fmt.Sprintf("user_id = $%d", nextArg))
		args = append(args, userID)
		nextArg++
	}
	if !cursorTime.IsZero() {
		where = append(where, fmt.Sprintf("(created_at, id) < ($%d, $%d)", nextArg, nextArg+1))
		args = append(args, cursorTime, cursorID)
		nextArg += 2
	}
	args = append(args, limit+1)
	q := fmt.Sprintf(`
		SELECT id, tenant_id, event_type, session_id, user_id, page_url, referrer, device_type, browser, country, properties_json, created_at
		FROM ecommerce_analytics_events
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), nextArg)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return listResponse{}, err
	}
	defer rows.Close()

	items := make([]analyticsEvent, 0, limit)
	for rows.Next() {
		var evt analyticsEvent
		var sid, uid, purl, ref, dt, br, co, pj sql.NullString
		if err := rows.Scan(&evt.ID, &evt.TenantID, &evt.EventType, &sid, &uid, &purl, &ref, &dt, &br, &co, &pj, &evt.CreatedAt); err != nil {
			return listResponse{}, err
		}
		evt.SessionID = sid.String
		evt.UserID = uid.String
		evt.PageURL = purl.String
		evt.Referrer = ref.String
		evt.DeviceType = dt.String
		evt.Browser = br.String
		evt.Country = co.String
		evt.PropertiesJSON = pj.String
		items = append(items, evt)
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
		s.setListCache(tenantID, eventType, sessionID, userID, cursor, limit, resp)
	}
	return resp, nil
}

func (s *service) listEventsMemory(tenantID, eventType, sessionID, userID, cursor string, limit int) listResponse {
	s.memMu.RLock()
	items := make([]analyticsEvent, 0)
	for _, evt := range s.memByID {
		if evt.TenantID != tenantID {
			continue
		}
		if eventType != "" && evt.EventType != eventType {
			continue
		}
		if sessionID != "" && evt.SessionID != sessionID {
			continue
		}
		if userID != "" && evt.UserID != userID {
			continue
		}
		items = append(items, evt)
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
// Explain
// ---------------------------------------------------------------------------

func (s *service) explainList(ctx context.Context, tenantID, eventType, sessionID, userID string) (any, error) {
	if s.db == nil {
		return map[string]any{"mode": "memory", "note": "no SQL plan available"}, nil
	}

	args := []any{tenantID}
	where := []string{"tenant_id = $1"}
	nextArg := 2
	if eventType != "" {
		where = append(where, fmt.Sprintf("event_type = $%d", nextArg))
		args = append(args, eventType)
		nextArg++
	}
	if sessionID != "" {
		where = append(where, fmt.Sprintf("session_id = $%d", nextArg))
		args = append(args, sessionID)
		nextArg++
	}
	if userID != "" {
		where = append(where, fmt.Sprintf("user_id = $%d", nextArg))
		args = append(args, userID)
		nextArg++
	}
	planQuery := fmt.Sprintf(`EXPLAIN (ANALYZE FALSE, FORMAT JSON)
		SELECT id, tenant_id, event_type, session_id, user_id, page_url, referrer, device_type, browser, country, properties_json, created_at
		FROM ecommerce_analytics_events
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

func (s *service) getListCache(tenantID, eventType, sessionID, userID, cursor string, limit int) (listResponse, bool) {
	key := cacheKey(tenantID, eventType, sessionID, userID, cursor, limit)
	s.cacheMu.RLock()
	item, ok := s.listCache[key]
	s.cacheMu.RUnlock()
	if !ok || time.Now().After(item.Expires) {
		return listResponse{}, false
	}
	return item.Response, true
}

func (s *service) setListCache(tenantID, eventType, sessionID, userID, cursor string, limit int, value listResponse) {
	key := cacheKey(tenantID, eventType, sessionID, userID, cursor, limit)
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

func cacheKey(tenantID, eventType, sessionID, userID, cursor string, limit int) string {
	return fmt.Sprintf("%s|%s|%s|%s|%s|%d", tenantID, eventType, sessionID, userID, cursor, limit)
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
		return fmt.Sprintf("aev_%d", time.Now().UnixNano())
	}
	return "aev_" + hex.EncodeToString(buf)
}
