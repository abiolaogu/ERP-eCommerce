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

type socialPost struct {
	ID              string     `json:"id"`
	TenantID        string     `json:"tenant_id"`
	Platform        string     `json:"platform"`
	ProductID       string     `json:"product_id,omitempty"`
	Content         string     `json:"content,omitempty"`
	MediaURLs       string     `json:"media_urls,omitempty"`
	PostURL         string     `json:"post_url,omitempty"`
	LikesCount      int        `json:"likes_count"`
	SharesCount     int        `json:"shares_count"`
	CommentsCount   int        `json:"comments_count"`
	ClickCount      int        `json:"click_count"`
	ConversionCount int        `json:"conversion_count"`
	Status          string     `json:"status"`
	ScheduledAt     *time.Time `json:"scheduled_at,omitempty"`
	PublishedAt     *time.Time `json:"published_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type createSocialPostRequest struct {
	Platform    string `json:"platform"`
	ProductID   string `json:"product_id"`
	Content     string `json:"content"`
	MediaURLs   string `json:"media_urls"`
	PostURL     string `json:"post_url"`
	Status      string `json:"status"`
	ScheduledAt string `json:"scheduled_at"`
}

type updateSocialPostRequest struct {
	Platform        *string `json:"platform,omitempty"`
	ProductID       *string `json:"product_id,omitempty"`
	Content         *string `json:"content,omitempty"`
	MediaURLs       *string `json:"media_urls,omitempty"`
	PostURL         *string `json:"post_url,omitempty"`
	LikesCount      *int    `json:"likes_count,omitempty"`
	SharesCount     *int    `json:"shares_count,omitempty"`
	CommentsCount   *int    `json:"comments_count,omitempty"`
	ClickCount      *int    `json:"click_count,omitempty"`
	ConversionCount *int    `json:"conversion_count,omitempty"`
	Status          *string `json:"status,omitempty"`
}

type listResponse struct {
	Items      []socialPost `json:"items"`
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
	memByID   map[string]socialPost
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
		memByID:   make(map[string]socialPost),
	}

	if db, err := connectDB(); err != nil {
		log.Printf("warn: database unavailable, running social-commerce in memory mode: %v", err)
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
		writeJSON(w, http.StatusOK, map[string]any{"status": "healthy", "module": module, "service": "social-commerce-service", "mode": mode})
	})

	base := "/v1/social-posts"

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
		platform := strings.TrimSpace(r.URL.Query().Get("platform"))
		status := strings.TrimSpace(r.URL.Query().Get("status"))
		productID := strings.TrimSpace(r.URL.Query().Get("product_id"))
		plan, err := svc.explainList(r.Context(), tenantID, platform, status, productID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"plan": plan, "event_topic": "erp.ecommerce.social-post.explain.generated"})
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
			platform := strings.TrimSpace(r.URL.Query().Get("platform"))
			status := strings.TrimSpace(r.URL.Query().Get("status"))
			productID := strings.TrimSpace(r.URL.Query().Get("product_id"))
			resp, err := svc.listPosts(r.Context(), tenantID, platform, status, productID, cursor, limit)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": resp.Items, "next_cursor": resp.NextCursor, "cached": resp.Cached, "event_topic": "erp.ecommerce.social-post.listed"})
		case http.MethodPost:
			var req createSocialPostRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			post, err := buildCreatePost(tenantID, req)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			if err := svc.createPost(r.Context(), post); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"item": post, "event_topic": "erp.ecommerce.social-post.created"})
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
			post, err := svc.getByID(r.Context(), tenantID, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "social post not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": post, "event_topic": "erp.ecommerce.social-post.read"})
		case http.MethodPut, http.MethodPatch:
			var req updateSocialPostRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			updated, err := svc.updatePost(r.Context(), tenantID, id, req)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "social post not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": updated, "event_topic": "erp.ecommerce.social-post.updated"})
		case http.MethodDelete:
			if err := svc.deletePost(r.Context(), tenantID, id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "social post not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "event_topic": "erp.ecommerce.social-post.deleted"})
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

	log.Printf("social-commerce-service listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}

// ---------------------------------------------------------------------------
// Build / Validate
// ---------------------------------------------------------------------------

func buildCreatePost(tenantID string, req createSocialPostRequest) (socialPost, error) {
	platform := normalizePlatform(req.Platform)
	if platform == "" {
		return socialPost{}, errors.New("platform is required and must be one of: instagram, facebook, tiktok, pinterest, twitter, youtube")
	}
	status := normalizeStatus(req.Status)
	if status == "" {
		status = "draft"
	}
	now := time.Now().UTC()
	post := socialPost{
		ID:        newID(),
		TenantID:  tenantID,
		Platform:  platform,
		ProductID: strings.TrimSpace(req.ProductID),
		Content:   strings.TrimSpace(req.Content),
		MediaURLs: strings.TrimSpace(req.MediaURLs),
		PostURL:   strings.TrimSpace(req.PostURL),
		Status:    status,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if strings.TrimSpace(req.ScheduledAt) != "" {
		parsed, err := time.Parse(time.RFC3339, req.ScheduledAt)
		if err != nil {
			return socialPost{}, errors.New("scheduled_at must be RFC3339")
		}
		t := parsed.UTC()
		post.ScheduledAt = &t
	}
	if status == "published" {
		post.PublishedAt = &now
	}
	return post, nil
}

func normalizePlatform(p string) string {
	s := strings.ToLower(strings.TrimSpace(p))
	switch s {
	case "instagram", "facebook", "tiktok", "pinterest", "twitter", "youtube":
		return s
	default:
		return ""
	}
}

func normalizeStatus(status string) string {
	s := strings.ToLower(strings.TrimSpace(status))
	switch s {
	case "draft", "scheduled", "published", "archived", "failed":
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
		`CREATE TABLE IF NOT EXISTS ecommerce_social_posts (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			platform TEXT CHECK (platform IN ('instagram','facebook','tiktok','pinterest','twitter','youtube')) NOT NULL,
			product_id TEXT,
			content TEXT,
			media_urls TEXT,
			post_url TEXT,
			likes_count INT DEFAULT 0,
			shares_count INT DEFAULT 0,
			comments_count INT DEFAULT 0,
			click_count INT DEFAULT 0,
			conversion_count INT DEFAULT 0,
			status TEXT CHECK (status IN ('draft','scheduled','published','archived','failed')) DEFAULT 'draft',
			scheduled_at TIMESTAMPTZ,
			published_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_created ON ecommerce_social_posts (tenant_id, created_at DESC, id DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_platform ON ecommerce_social_posts (tenant_id, platform)`,
		`CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_status ON ecommerce_social_posts (tenant_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_product ON ecommerce_social_posts (tenant_id, product_id)`,
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

func (s *service) createPost(ctx context.Context, post socialPost) error {
	if s.db == nil {
		s.memMu.Lock()
		s.memByID[post.ID] = post
		s.memMu.Unlock()
		s.invalidateTenantCache(post.TenantID)
		return nil
	}
	q := `INSERT INTO ecommerce_social_posts (id, tenant_id, platform, product_id, content, media_urls, post_url, likes_count, shares_count, comments_count, click_count, conversion_count, status, scheduled_at, published_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`
	if _, err := s.db.ExecContext(ctx, q,
		post.ID, post.TenantID, post.Platform, nilIfEmpty(post.ProductID),
		nilIfEmpty(post.Content), nilIfEmpty(post.MediaURLs), nilIfEmpty(post.PostURL),
		post.LikesCount, post.SharesCount, post.CommentsCount, post.ClickCount, post.ConversionCount,
		post.Status, post.ScheduledAt, post.PublishedAt, post.CreatedAt, post.UpdatedAt,
	); err != nil {
		return err
	}
	s.invalidateTenantCache(post.TenantID)
	return nil
}

// ---------------------------------------------------------------------------
// CRUD - Read
// ---------------------------------------------------------------------------

func (s *service) getByID(ctx context.Context, tenantID, id string) (socialPost, error) {
	if s.db == nil {
		s.memMu.RLock()
		post, ok := s.memByID[id]
		s.memMu.RUnlock()
		if !ok || post.TenantID != tenantID {
			return socialPost{}, sql.ErrNoRows
		}
		return post, nil
	}

	q := `SELECT id, tenant_id, platform, product_id, content, media_urls, post_url, likes_count, shares_count, comments_count, click_count, conversion_count, status, scheduled_at, published_at, created_at, updated_at
		FROM ecommerce_social_posts WHERE tenant_id=$1 AND id=$2`
	var post socialPost
	var productID, content, mediaURLs, postURL sql.NullString
	var scheduledAt, publishedAt sql.NullTime
	err := s.db.QueryRowContext(ctx, q, tenantID, id).Scan(
		&post.ID, &post.TenantID, &post.Platform, &productID, &content, &mediaURLs, &postURL,
		&post.LikesCount, &post.SharesCount, &post.CommentsCount, &post.ClickCount, &post.ConversionCount,
		&post.Status, &scheduledAt, &publishedAt, &post.CreatedAt, &post.UpdatedAt,
	)
	if err != nil {
		return socialPost{}, err
	}
	post.ProductID = productID.String
	post.Content = content.String
	post.MediaURLs = mediaURLs.String
	post.PostURL = postURL.String
	if scheduledAt.Valid {
		post.ScheduledAt = &scheduledAt.Time
	}
	if publishedAt.Valid {
		post.PublishedAt = &publishedAt.Time
	}
	return post, nil
}

// ---------------------------------------------------------------------------
// CRUD - List
// ---------------------------------------------------------------------------

func (s *service) listPosts(ctx context.Context, tenantID, platform, status, productID, cursor string, limit int) (listResponse, error) {
	if cursor == "" {
		if cached, ok := s.getListCache(tenantID, platform, status, productID, cursor, limit); ok {
			cached.Cached = true
			return cached, nil
		}
	}

	if s.db == nil {
		resp := s.listPostsMemory(tenantID, platform, status, productID, cursor, limit)
		if cursor == "" {
			s.setListCache(tenantID, platform, status, productID, cursor, limit, resp)
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
	if platform != "" {
		where = append(where, fmt.Sprintf("platform = $%d", nextArg))
		args = append(args, normalizePlatform(platform))
		nextArg++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	if productID != "" {
		where = append(where, fmt.Sprintf("product_id = $%d", nextArg))
		args = append(args, productID)
		nextArg++
	}
	if !cursorTime.IsZero() {
		where = append(where, fmt.Sprintf("(created_at, id) < ($%d, $%d)", nextArg, nextArg+1))
		args = append(args, cursorTime, cursorID)
		nextArg += 2
	}
	args = append(args, limit+1)
	q := fmt.Sprintf(`
		SELECT id, tenant_id, platform, product_id, content, media_urls, post_url, likes_count, shares_count, comments_count, click_count, conversion_count, status, scheduled_at, published_at, created_at, updated_at
		FROM ecommerce_social_posts
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), nextArg)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return listResponse{}, err
	}
	defer rows.Close()

	items := make([]socialPost, 0, limit)
	for rows.Next() {
		var post socialPost
		var pid, cnt, mu, pu sql.NullString
		var sa, pa sql.NullTime
		if err := rows.Scan(&post.ID, &post.TenantID, &post.Platform, &pid, &cnt, &mu, &pu,
			&post.LikesCount, &post.SharesCount, &post.CommentsCount, &post.ClickCount, &post.ConversionCount,
			&post.Status, &sa, &pa, &post.CreatedAt, &post.UpdatedAt); err != nil {
			return listResponse{}, err
		}
		post.ProductID = pid.String
		post.Content = cnt.String
		post.MediaURLs = mu.String
		post.PostURL = pu.String
		if sa.Valid {
			post.ScheduledAt = &sa.Time
		}
		if pa.Valid {
			post.PublishedAt = &pa.Time
		}
		items = append(items, post)
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
		s.setListCache(tenantID, platform, status, productID, cursor, limit, resp)
	}
	return resp, nil
}

func (s *service) listPostsMemory(tenantID, platform, status, productID, cursor string, limit int) listResponse {
	s.memMu.RLock()
	items := make([]socialPost, 0)
	for _, post := range s.memByID {
		if post.TenantID != tenantID {
			continue
		}
		if platform != "" && post.Platform != normalizePlatform(platform) {
			continue
		}
		if status != "" && post.Status != normalizeStatus(status) {
			continue
		}
		if productID != "" && post.ProductID != productID {
			continue
		}
		items = append(items, post)
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

func (s *service) updatePost(ctx context.Context, tenantID, id string, req updateSocialPostRequest) (socialPost, error) {
	if req.Platform == nil && req.ProductID == nil && req.Content == nil && req.MediaURLs == nil &&
		req.PostURL == nil && req.LikesCount == nil && req.SharesCount == nil && req.CommentsCount == nil &&
		req.ClickCount == nil && req.ConversionCount == nil && req.Status == nil {
		return socialPost{}, errors.New("empty update payload")
	}

	if s.db == nil {
		s.memMu.Lock()
		post, ok := s.memByID[id]
		if !ok || post.TenantID != tenantID {
			s.memMu.Unlock()
			return socialPost{}, sql.ErrNoRows
		}
		if req.Platform != nil {
			p := normalizePlatform(*req.Platform)
			if p == "" {
				s.memMu.Unlock()
				return socialPost{}, errors.New("invalid platform")
			}
			post.Platform = p
		}
		if req.ProductID != nil {
			post.ProductID = strings.TrimSpace(*req.ProductID)
		}
		if req.Content != nil {
			post.Content = strings.TrimSpace(*req.Content)
		}
		if req.MediaURLs != nil {
			post.MediaURLs = strings.TrimSpace(*req.MediaURLs)
		}
		if req.PostURL != nil {
			post.PostURL = strings.TrimSpace(*req.PostURL)
		}
		if req.LikesCount != nil {
			post.LikesCount = *req.LikesCount
		}
		if req.SharesCount != nil {
			post.SharesCount = *req.SharesCount
		}
		if req.CommentsCount != nil {
			post.CommentsCount = *req.CommentsCount
		}
		if req.ClickCount != nil {
			post.ClickCount = *req.ClickCount
		}
		if req.ConversionCount != nil {
			post.ConversionCount = *req.ConversionCount
		}
		if req.Status != nil {
			ns := normalizeStatus(*req.Status)
			if ns == "" {
				s.memMu.Unlock()
				return socialPost{}, errors.New("invalid status")
			}
			post.Status = ns
			if ns == "published" {
				now := time.Now().UTC()
				post.PublishedAt = &now
			}
		}
		post.UpdatedAt = time.Now().UTC()
		s.memByID[id] = post
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return post, nil
	}

	assignments := make([]string, 0, 12)
	args := []any{tenantID, id}
	next := 3
	if req.Platform != nil {
		p := normalizePlatform(*req.Platform)
		if p == "" {
			return socialPost{}, errors.New("invalid platform")
		}
		assignments = append(assignments, fmt.Sprintf("platform = $%d", next))
		args = append(args, p)
		next++
	}
	if req.ProductID != nil {
		assignments = append(assignments, fmt.Sprintf("product_id = $%d", next))
		args = append(args, strings.TrimSpace(*req.ProductID))
		next++
	}
	if req.Content != nil {
		assignments = append(assignments, fmt.Sprintf("content = $%d", next))
		args = append(args, strings.TrimSpace(*req.Content))
		next++
	}
	if req.MediaURLs != nil {
		assignments = append(assignments, fmt.Sprintf("media_urls = $%d", next))
		args = append(args, strings.TrimSpace(*req.MediaURLs))
		next++
	}
	if req.PostURL != nil {
		assignments = append(assignments, fmt.Sprintf("post_url = $%d", next))
		args = append(args, strings.TrimSpace(*req.PostURL))
		next++
	}
	if req.LikesCount != nil {
		assignments = append(assignments, fmt.Sprintf("likes_count = $%d", next))
		args = append(args, *req.LikesCount)
		next++
	}
	if req.SharesCount != nil {
		assignments = append(assignments, fmt.Sprintf("shares_count = $%d", next))
		args = append(args, *req.SharesCount)
		next++
	}
	if req.CommentsCount != nil {
		assignments = append(assignments, fmt.Sprintf("comments_count = $%d", next))
		args = append(args, *req.CommentsCount)
		next++
	}
	if req.ClickCount != nil {
		assignments = append(assignments, fmt.Sprintf("click_count = $%d", next))
		args = append(args, *req.ClickCount)
		next++
	}
	if req.ConversionCount != nil {
		assignments = append(assignments, fmt.Sprintf("conversion_count = $%d", next))
		args = append(args, *req.ConversionCount)
		next++
	}
	if req.Status != nil {
		ns := normalizeStatus(*req.Status)
		if ns == "" {
			return socialPost{}, errors.New("invalid status")
		}
		assignments = append(assignments, fmt.Sprintf("status = $%d", next))
		args = append(args, ns)
		next++
		if ns == "published" {
			assignments = append(assignments, fmt.Sprintf("published_at = $%d", next))
			args = append(args, time.Now().UTC())
			next++
		}
	}

	assignments = append(assignments, fmt.Sprintf("updated_at = $%d", next))
	args = append(args, time.Now().UTC())

	q := fmt.Sprintf(`UPDATE ecommerce_social_posts SET %s WHERE tenant_id = $1 AND id = $2`, strings.Join(assignments, ", "))
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return socialPost{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return socialPost{}, err
	}
	if affected == 0 {
		return socialPost{}, sql.ErrNoRows
	}
	s.invalidateTenantCache(tenantID)
	return s.getByID(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// CRUD - Delete
// ---------------------------------------------------------------------------

func (s *service) deletePost(ctx context.Context, tenantID, id string) error {
	if s.db == nil {
		s.memMu.Lock()
		post, ok := s.memByID[id]
		if !ok || post.TenantID != tenantID {
			s.memMu.Unlock()
			return sql.ErrNoRows
		}
		delete(s.memByID, id)
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return nil
	}

	res, err := s.db.ExecContext(ctx, `DELETE FROM ecommerce_social_posts WHERE tenant_id=$1 AND id=$2`, tenantID, id)
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

func (s *service) explainList(ctx context.Context, tenantID, platform, status, productID string) (any, error) {
	if s.db == nil {
		return map[string]any{"mode": "memory", "note": "no SQL plan available"}, nil
	}

	args := []any{tenantID}
	where := []string{"tenant_id = $1"}
	nextArg := 2
	if platform != "" {
		where = append(where, fmt.Sprintf("platform = $%d", nextArg))
		args = append(args, normalizePlatform(platform))
		nextArg++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	if productID != "" {
		where = append(where, fmt.Sprintf("product_id = $%d", nextArg))
		args = append(args, productID)
		nextArg++
	}
	planQuery := fmt.Sprintf(`EXPLAIN (ANALYZE FALSE, FORMAT JSON)
		SELECT id, tenant_id, platform, product_id, content, media_urls, post_url, likes_count, shares_count, comments_count, click_count, conversion_count, status, scheduled_at, published_at, created_at, updated_at
		FROM ecommerce_social_posts
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

func (s *service) getListCache(tenantID, platform, status, productID, cursor string, limit int) (listResponse, bool) {
	key := cacheKey(tenantID, platform, status, productID, cursor, limit)
	s.cacheMu.RLock()
	item, ok := s.listCache[key]
	s.cacheMu.RUnlock()
	if !ok || time.Now().After(item.Expires) {
		return listResponse{}, false
	}
	return item.Response, true
}

func (s *service) setListCache(tenantID, platform, status, productID, cursor string, limit int, value listResponse) {
	key := cacheKey(tenantID, platform, status, productID, cursor, limit)
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

func cacheKey(tenantID, platform, status, productID, cursor string, limit int) string {
	return fmt.Sprintf("%s|%s|%s|%s|%s|%d", tenantID, normalizePlatform(platform), normalizeStatus(status), productID, cursor, limit)
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
		return fmt.Sprintf("sp_%d", time.Now().UnixNano())
	}
	return "sp_" + hex.EncodeToString(buf)
}
