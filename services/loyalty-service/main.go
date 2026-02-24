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

type loyaltyAccount struct {
	ID                string     `json:"id"`
	TenantID          string     `json:"tenant_id"`
	CustomerID        string     `json:"customer_id"`
	Tier              string     `json:"tier"`
	PointsBalance     int        `json:"points_balance"`
	LifetimePoints    int        `json:"lifetime_points"`
	PointsEarnedYTD   int        `json:"points_earned_ytd"`
	PointsRedeemedYTD int        `json:"points_redeemed_ytd"`
	Status            string     `json:"status"`
	JoinedAt          *time.Time `json:"joined_at,omitempty"`
	LastActivityAt    *time.Time `json:"last_activity_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type createLoyaltyAccountRequest struct {
	CustomerID        string `json:"customer_id"`
	Tier              string `json:"tier"`
	PointsBalance     int    `json:"points_balance"`
	LifetimePoints    int    `json:"lifetime_points"`
	PointsEarnedYTD   int    `json:"points_earned_ytd"`
	PointsRedeemedYTD int    `json:"points_redeemed_ytd"`
	Status            string `json:"status"`
	JoinedAt          string `json:"joined_at"`
}

type updateLoyaltyAccountRequest struct {
	Tier              *string `json:"tier,omitempty"`
	PointsBalance     *int    `json:"points_balance,omitempty"`
	LifetimePoints    *int    `json:"lifetime_points,omitempty"`
	PointsEarnedYTD   *int    `json:"points_earned_ytd,omitempty"`
	PointsRedeemedYTD *int    `json:"points_redeemed_ytd,omitempty"`
	Status            *string `json:"status,omitempty"`
}

type listResponse struct {
	Items      []loyaltyAccount `json:"items"`
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
	memByID   map[string]loyaltyAccount
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
		memByID:   make(map[string]loyaltyAccount),
	}

	if db, err := connectDB(); err != nil {
		log.Printf("warn: database unavailable, running loyalty in memory mode: %v", err)
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
		writeJSON(w, http.StatusOK, map[string]any{"status": "healthy", "module": module, "service": "loyalty-service", "mode": mode})
	})

	base := "/v1/loyalty-accounts"

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
		customerID := strings.TrimSpace(r.URL.Query().Get("customer_id"))
		tier := strings.TrimSpace(r.URL.Query().Get("tier"))
		status := strings.TrimSpace(r.URL.Query().Get("status"))
		plan, err := svc.explainList(r.Context(), tenantID, customerID, tier, status)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"plan": plan, "event_topic": "erp.ecommerce.loyalty-account.explain.generated"})
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
			customerID := strings.TrimSpace(r.URL.Query().Get("customer_id"))
			tier := strings.TrimSpace(r.URL.Query().Get("tier"))
			status := strings.TrimSpace(r.URL.Query().Get("status"))
			resp, err := svc.listAccounts(r.Context(), tenantID, customerID, tier, status, cursor, limit)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": resp.Items, "next_cursor": resp.NextCursor, "cached": resp.Cached, "event_topic": "erp.ecommerce.loyalty-account.listed"})
		case http.MethodPost:
			var req createLoyaltyAccountRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			acct, err := buildCreateAccount(tenantID, req)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			if err := svc.createAccount(r.Context(), acct); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"item": acct, "event_topic": "erp.ecommerce.loyalty-account.created"})
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
			acct, err := svc.getByID(r.Context(), tenantID, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "loyalty account not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": acct, "event_topic": "erp.ecommerce.loyalty-account.read"})
		case http.MethodPut, http.MethodPatch:
			var req updateLoyaltyAccountRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			updated, err := svc.updateAccount(r.Context(), tenantID, id, req)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "loyalty account not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": updated, "event_topic": "erp.ecommerce.loyalty-account.updated"})
		case http.MethodDelete:
			if err := svc.deleteAccount(r.Context(), tenantID, id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "loyalty account not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "event_topic": "erp.ecommerce.loyalty-account.deleted"})
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

	log.Printf("loyalty-service listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}

// ---------------------------------------------------------------------------
// Build / Validate
// ---------------------------------------------------------------------------

func buildCreateAccount(tenantID string, req createLoyaltyAccountRequest) (loyaltyAccount, error) {
	if strings.TrimSpace(req.CustomerID) == "" {
		return loyaltyAccount{}, errors.New("customer_id is required")
	}
	tier := normalizeTier(req.Tier)
	if tier == "" {
		tier = "bronze"
	}
	status := normalizeStatus(req.Status)
	if status == "" {
		status = "active"
	}
	now := time.Now().UTC()
	acct := loyaltyAccount{
		ID:                newID(),
		TenantID:          tenantID,
		CustomerID:        strings.TrimSpace(req.CustomerID),
		Tier:              tier,
		PointsBalance:     req.PointsBalance,
		LifetimePoints:    req.LifetimePoints,
		PointsEarnedYTD:   req.PointsEarnedYTD,
		PointsRedeemedYTD: req.PointsRedeemedYTD,
		Status:            status,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if strings.TrimSpace(req.JoinedAt) != "" {
		parsed, err := time.Parse(time.RFC3339, req.JoinedAt)
		if err != nil {
			return loyaltyAccount{}, errors.New("joined_at must be RFC3339")
		}
		t := parsed.UTC()
		acct.JoinedAt = &t
	} else {
		acct.JoinedAt = &now
	}
	return acct, nil
}

func normalizeTier(tier string) string {
	s := strings.ToLower(strings.TrimSpace(tier))
	switch s {
	case "bronze", "silver", "gold", "platinum", "diamond":
		return s
	default:
		return ""
	}
}

func normalizeStatus(status string) string {
	s := strings.ToLower(strings.TrimSpace(status))
	switch s {
	case "active", "suspended", "closed":
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
		`CREATE TABLE IF NOT EXISTS ecommerce_loyalty_accounts (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			customer_id TEXT NOT NULL,
			tier TEXT CHECK (tier IN ('bronze','silver','gold','platinum','diamond')) DEFAULT 'bronze',
			points_balance INT DEFAULT 0,
			lifetime_points INT DEFAULT 0,
			points_earned_ytd INT DEFAULT 0,
			points_redeemed_ytd INT DEFAULT 0,
			status TEXT CHECK (status IN ('active','suspended','closed')) DEFAULT 'active',
			joined_at TIMESTAMPTZ,
			last_activity_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_tenant_created ON ecommerce_loyalty_accounts (tenant_id, created_at DESC, id DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_tenant_customer ON ecommerce_loyalty_accounts (tenant_id, customer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_tenant_tier ON ecommerce_loyalty_accounts (tenant_id, tier)`,
		`CREATE INDEX IF NOT EXISTS idx_loyalty_tenant_status ON ecommerce_loyalty_accounts (tenant_id, status)`,
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

func (s *service) createAccount(ctx context.Context, acct loyaltyAccount) error {
	if s.db == nil {
		s.memMu.Lock()
		s.memByID[acct.ID] = acct
		s.memMu.Unlock()
		s.invalidateTenantCache(acct.TenantID)
		return nil
	}
	q := `INSERT INTO ecommerce_loyalty_accounts (id, tenant_id, customer_id, tier, points_balance, lifetime_points, points_earned_ytd, points_redeemed_ytd, status, joined_at, last_activity_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`
	if _, err := s.db.ExecContext(ctx, q,
		acct.ID, acct.TenantID, acct.CustomerID, acct.Tier,
		acct.PointsBalance, acct.LifetimePoints, acct.PointsEarnedYTD, acct.PointsRedeemedYTD,
		acct.Status, acct.JoinedAt, acct.LastActivityAt, acct.CreatedAt, acct.UpdatedAt,
	); err != nil {
		return err
	}
	s.invalidateTenantCache(acct.TenantID)
	return nil
}

// ---------------------------------------------------------------------------
// CRUD - Read
// ---------------------------------------------------------------------------

func (s *service) getByID(ctx context.Context, tenantID, id string) (loyaltyAccount, error) {
	if s.db == nil {
		s.memMu.RLock()
		acct, ok := s.memByID[id]
		s.memMu.RUnlock()
		if !ok || acct.TenantID != tenantID {
			return loyaltyAccount{}, sql.ErrNoRows
		}
		return acct, nil
	}

	q := `SELECT id, tenant_id, customer_id, tier, points_balance, lifetime_points, points_earned_ytd, points_redeemed_ytd, status, joined_at, last_activity_at, created_at, updated_at
		FROM ecommerce_loyalty_accounts WHERE tenant_id=$1 AND id=$2`
	var acct loyaltyAccount
	var joinedAt, lastActivity sql.NullTime
	err := s.db.QueryRowContext(ctx, q, tenantID, id).Scan(
		&acct.ID, &acct.TenantID, &acct.CustomerID, &acct.Tier,
		&acct.PointsBalance, &acct.LifetimePoints, &acct.PointsEarnedYTD, &acct.PointsRedeemedYTD,
		&acct.Status, &joinedAt, &lastActivity, &acct.CreatedAt, &acct.UpdatedAt,
	)
	if err != nil {
		return loyaltyAccount{}, err
	}
	if joinedAt.Valid {
		acct.JoinedAt = &joinedAt.Time
	}
	if lastActivity.Valid {
		acct.LastActivityAt = &lastActivity.Time
	}
	return acct, nil
}

// ---------------------------------------------------------------------------
// CRUD - List
// ---------------------------------------------------------------------------

func (s *service) listAccounts(ctx context.Context, tenantID, customerID, tier, status, cursor string, limit int) (listResponse, error) {
	if cursor == "" {
		if cached, ok := s.getListCache(tenantID, customerID, tier, status, cursor, limit); ok {
			cached.Cached = true
			return cached, nil
		}
	}

	if s.db == nil {
		resp := s.listAccountsMemory(tenantID, customerID, tier, status, cursor, limit)
		if cursor == "" {
			s.setListCache(tenantID, customerID, tier, status, cursor, limit, resp)
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
	if customerID != "" {
		where = append(where, fmt.Sprintf("customer_id = $%d", nextArg))
		args = append(args, customerID)
		nextArg++
	}
	if tier != "" {
		where = append(where, fmt.Sprintf("tier = $%d", nextArg))
		args = append(args, normalizeTier(tier))
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
		SELECT id, tenant_id, customer_id, tier, points_balance, lifetime_points, points_earned_ytd, points_redeemed_ytd, status, joined_at, last_activity_at, created_at, updated_at
		FROM ecommerce_loyalty_accounts
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), nextArg)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return listResponse{}, err
	}
	defer rows.Close()

	items := make([]loyaltyAccount, 0, limit)
	for rows.Next() {
		var acct loyaltyAccount
		var ja, la sql.NullTime
		if err := rows.Scan(&acct.ID, &acct.TenantID, &acct.CustomerID, &acct.Tier,
			&acct.PointsBalance, &acct.LifetimePoints, &acct.PointsEarnedYTD, &acct.PointsRedeemedYTD,
			&acct.Status, &ja, &la, &acct.CreatedAt, &acct.UpdatedAt); err != nil {
			return listResponse{}, err
		}
		if ja.Valid {
			acct.JoinedAt = &ja.Time
		}
		if la.Valid {
			acct.LastActivityAt = &la.Time
		}
		items = append(items, acct)
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
		s.setListCache(tenantID, customerID, tier, status, cursor, limit, resp)
	}
	return resp, nil
}

func (s *service) listAccountsMemory(tenantID, customerID, tier, status, cursor string, limit int) listResponse {
	s.memMu.RLock()
	items := make([]loyaltyAccount, 0)
	for _, acct := range s.memByID {
		if acct.TenantID != tenantID {
			continue
		}
		if customerID != "" && acct.CustomerID != customerID {
			continue
		}
		if tier != "" && acct.Tier != normalizeTier(tier) {
			continue
		}
		if status != "" && acct.Status != normalizeStatus(status) {
			continue
		}
		items = append(items, acct)
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

func (s *service) updateAccount(ctx context.Context, tenantID, id string, req updateLoyaltyAccountRequest) (loyaltyAccount, error) {
	if req.Tier == nil && req.PointsBalance == nil && req.LifetimePoints == nil &&
		req.PointsEarnedYTD == nil && req.PointsRedeemedYTD == nil && req.Status == nil {
		return loyaltyAccount{}, errors.New("empty update payload")
	}

	if s.db == nil {
		s.memMu.Lock()
		acct, ok := s.memByID[id]
		if !ok || acct.TenantID != tenantID {
			s.memMu.Unlock()
			return loyaltyAccount{}, sql.ErrNoRows
		}
		if req.Tier != nil {
			t := normalizeTier(*req.Tier)
			if t == "" {
				s.memMu.Unlock()
				return loyaltyAccount{}, errors.New("invalid tier")
			}
			acct.Tier = t
		}
		if req.PointsBalance != nil {
			acct.PointsBalance = *req.PointsBalance
		}
		if req.LifetimePoints != nil {
			acct.LifetimePoints = *req.LifetimePoints
		}
		if req.PointsEarnedYTD != nil {
			acct.PointsEarnedYTD = *req.PointsEarnedYTD
		}
		if req.PointsRedeemedYTD != nil {
			acct.PointsRedeemedYTD = *req.PointsRedeemedYTD
		}
		if req.Status != nil {
			ns := normalizeStatus(*req.Status)
			if ns == "" {
				s.memMu.Unlock()
				return loyaltyAccount{}, errors.New("invalid status")
			}
			acct.Status = ns
		}
		now := time.Now().UTC()
		acct.LastActivityAt = &now
		acct.UpdatedAt = now
		s.memByID[id] = acct
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return acct, nil
	}

	assignments := make([]string, 0, 8)
	args := []any{tenantID, id}
	next := 3
	if req.Tier != nil {
		t := normalizeTier(*req.Tier)
		if t == "" {
			return loyaltyAccount{}, errors.New("invalid tier")
		}
		assignments = append(assignments, fmt.Sprintf("tier = $%d", next))
		args = append(args, t)
		next++
	}
	if req.PointsBalance != nil {
		assignments = append(assignments, fmt.Sprintf("points_balance = $%d", next))
		args = append(args, *req.PointsBalance)
		next++
	}
	if req.LifetimePoints != nil {
		assignments = append(assignments, fmt.Sprintf("lifetime_points = $%d", next))
		args = append(args, *req.LifetimePoints)
		next++
	}
	if req.PointsEarnedYTD != nil {
		assignments = append(assignments, fmt.Sprintf("points_earned_ytd = $%d", next))
		args = append(args, *req.PointsEarnedYTD)
		next++
	}
	if req.PointsRedeemedYTD != nil {
		assignments = append(assignments, fmt.Sprintf("points_redeemed_ytd = $%d", next))
		args = append(args, *req.PointsRedeemedYTD)
		next++
	}
	if req.Status != nil {
		ns := normalizeStatus(*req.Status)
		if ns == "" {
			return loyaltyAccount{}, errors.New("invalid status")
		}
		assignments = append(assignments, fmt.Sprintf("status = $%d", next))
		args = append(args, ns)
		next++
	}

	now := time.Now().UTC()
	assignments = append(assignments, fmt.Sprintf("last_activity_at = $%d", next))
	args = append(args, now)
	next++
	assignments = append(assignments, fmt.Sprintf("updated_at = $%d", next))
	args = append(args, now)

	q := fmt.Sprintf(`UPDATE ecommerce_loyalty_accounts SET %s WHERE tenant_id = $1 AND id = $2`, strings.Join(assignments, ", "))
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return loyaltyAccount{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return loyaltyAccount{}, err
	}
	if affected == 0 {
		return loyaltyAccount{}, sql.ErrNoRows
	}
	s.invalidateTenantCache(tenantID)
	return s.getByID(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// CRUD - Delete
// ---------------------------------------------------------------------------

func (s *service) deleteAccount(ctx context.Context, tenantID, id string) error {
	if s.db == nil {
		s.memMu.Lock()
		acct, ok := s.memByID[id]
		if !ok || acct.TenantID != tenantID {
			s.memMu.Unlock()
			return sql.ErrNoRows
		}
		delete(s.memByID, id)
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return nil
	}

	res, err := s.db.ExecContext(ctx, `DELETE FROM ecommerce_loyalty_accounts WHERE tenant_id=$1 AND id=$2`, tenantID, id)
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

func (s *service) explainList(ctx context.Context, tenantID, customerID, tier, status string) (any, error) {
	if s.db == nil {
		return map[string]any{"mode": "memory", "note": "no SQL plan available"}, nil
	}

	args := []any{tenantID}
	where := []string{"tenant_id = $1"}
	nextArg := 2
	if customerID != "" {
		where = append(where, fmt.Sprintf("customer_id = $%d", nextArg))
		args = append(args, customerID)
		nextArg++
	}
	if tier != "" {
		where = append(where, fmt.Sprintf("tier = $%d", nextArg))
		args = append(args, normalizeTier(tier))
		nextArg++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	planQuery := fmt.Sprintf(`EXPLAIN (ANALYZE FALSE, FORMAT JSON)
		SELECT id, tenant_id, customer_id, tier, points_balance, lifetime_points, points_earned_ytd, points_redeemed_ytd, status, joined_at, last_activity_at, created_at, updated_at
		FROM ecommerce_loyalty_accounts
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

func (s *service) getListCache(tenantID, customerID, tier, status, cursor string, limit int) (listResponse, bool) {
	key := cacheKey(tenantID, customerID, tier, status, cursor, limit)
	s.cacheMu.RLock()
	item, ok := s.listCache[key]
	s.cacheMu.RUnlock()
	if !ok || time.Now().After(item.Expires) {
		return listResponse{}, false
	}
	return item.Response, true
}

func (s *service) setListCache(tenantID, customerID, tier, status, cursor string, limit int, value listResponse) {
	key := cacheKey(tenantID, customerID, tier, status, cursor, limit)
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

func cacheKey(tenantID, customerID, tier, status, cursor string, limit int) string {
	return fmt.Sprintf("%s|%s|%s|%s|%s|%d", tenantID, customerID, normalizeTier(tier), normalizeStatus(status), cursor, limit)
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
		return fmt.Sprintf("la_%d", time.Now().UnixNano())
	}
	return "la_" + hex.EncodeToString(buf)
}
