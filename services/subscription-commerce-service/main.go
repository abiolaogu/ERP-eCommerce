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

type subscription struct {
	ID                 string     `json:"id"`
	TenantID           string     `json:"tenant_id"`
	CustomerID         string     `json:"customer_id"`
	PlanID             string     `json:"plan_id"`
	PlanName           string     `json:"plan_name,omitempty"`
	Interval           string     `json:"interval"`
	Price              string     `json:"price"`
	Currency           string     `json:"currency"`
	Status             string     `json:"status"`
	TrialEndsAt        *time.Time `json:"trial_ends_at,omitempty"`
	CurrentPeriodStart *time.Time `json:"current_period_start,omitempty"`
	CurrentPeriodEnd   *time.Time `json:"current_period_end,omitempty"`
	CancelledAt        *time.Time `json:"cancelled_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type createSubscriptionRequest struct {
	CustomerID         string `json:"customer_id"`
	PlanID             string `json:"plan_id"`
	PlanName           string `json:"plan_name"`
	Interval           string `json:"interval"`
	Price              string `json:"price"`
	Currency           string `json:"currency"`
	Status             string `json:"status"`
	TrialEndsAt        string `json:"trial_ends_at"`
	CurrentPeriodStart string `json:"current_period_start"`
	CurrentPeriodEnd   string `json:"current_period_end"`
}

type updateSubscriptionRequest struct {
	PlanID             *string `json:"plan_id,omitempty"`
	PlanName           *string `json:"plan_name,omitempty"`
	Interval           *string `json:"interval,omitempty"`
	Price              *string `json:"price,omitempty"`
	Currency           *string `json:"currency,omitempty"`
	Status             *string `json:"status,omitempty"`
	CurrentPeriodStart *string `json:"current_period_start,omitempty"`
	CurrentPeriodEnd   *string `json:"current_period_end,omitempty"`
}

type listResponse struct {
	Items      []subscription `json:"items"`
	NextCursor string         `json:"next_cursor,omitempty"`
	Cached     bool           `json:"cached"`
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
	memByID   map[string]subscription
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
		memByID:   make(map[string]subscription),
	}

	if db, err := connectDB(); err != nil {
		log.Printf("warn: database unavailable, running subscription in memory mode: %v", err)
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
		writeJSON(w, http.StatusOK, map[string]any{"status": "healthy", "module": module, "service": "subscription-commerce-service", "mode": mode})
	})

	base := "/v1/subscriptions"

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
		status := strings.TrimSpace(r.URL.Query().Get("status"))
		planID := strings.TrimSpace(r.URL.Query().Get("plan_id"))
		plan, err := svc.explainList(r.Context(), tenantID, customerID, status, planID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"plan": plan, "event_topic": "erp.ecommerce.subscription.explain.generated"})
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
			status := strings.TrimSpace(r.URL.Query().Get("status"))
			planID := strings.TrimSpace(r.URL.Query().Get("plan_id"))
			resp, err := svc.listSubscriptions(r.Context(), tenantID, customerID, status, planID, cursor, limit)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": resp.Items, "next_cursor": resp.NextCursor, "cached": resp.Cached, "event_topic": "erp.ecommerce.subscription.listed"})
		case http.MethodPost:
			var req createSubscriptionRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			sub, err := buildCreateSubscription(tenantID, req)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			if err := svc.createSubscription(r.Context(), sub); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"item": sub, "event_topic": "erp.ecommerce.subscription.created"})
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
			sub, err := svc.getByID(r.Context(), tenantID, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "subscription not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": sub, "event_topic": "erp.ecommerce.subscription.read"})
		case http.MethodPut, http.MethodPatch:
			var req updateSubscriptionRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			updated, err := svc.updateSubscription(r.Context(), tenantID, id, req)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "subscription not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": updated, "event_topic": "erp.ecommerce.subscription.updated"})
		case http.MethodDelete:
			if err := svc.deleteSubscription(r.Context(), tenantID, id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "subscription not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "event_topic": "erp.ecommerce.subscription.deleted"})
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

	log.Printf("subscription-commerce-service listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}

// ---------------------------------------------------------------------------
// Build / Validate
// ---------------------------------------------------------------------------

func buildCreateSubscription(tenantID string, req createSubscriptionRequest) (subscription, error) {
	if strings.TrimSpace(req.CustomerID) == "" {
		return subscription{}, errors.New("customer_id is required")
	}
	if strings.TrimSpace(req.PlanID) == "" {
		return subscription{}, errors.New("plan_id is required")
	}
	if strings.TrimSpace(req.Price) == "" {
		return subscription{}, errors.New("price is required")
	}
	interval := normalizeInterval(req.Interval)
	if interval == "" {
		interval = "monthly"
	}
	status := normalizeStatus(req.Status)
	if status == "" {
		status = "trialing"
	}
	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "USD"
	}
	now := time.Now().UTC()
	sub := subscription{
		ID:         newID(),
		TenantID:   tenantID,
		CustomerID: strings.TrimSpace(req.CustomerID),
		PlanID:     strings.TrimSpace(req.PlanID),
		PlanName:   strings.TrimSpace(req.PlanName),
		Interval:   interval,
		Price:      strings.TrimSpace(req.Price),
		Currency:   currency,
		Status:     status,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if strings.TrimSpace(req.TrialEndsAt) != "" {
		parsed, err := time.Parse(time.RFC3339, req.TrialEndsAt)
		if err != nil {
			return subscription{}, errors.New("trial_ends_at must be RFC3339")
		}
		t := parsed.UTC()
		sub.TrialEndsAt = &t
	}
	if strings.TrimSpace(req.CurrentPeriodStart) != "" {
		parsed, err := time.Parse(time.RFC3339, req.CurrentPeriodStart)
		if err != nil {
			return subscription{}, errors.New("current_period_start must be RFC3339")
		}
		t := parsed.UTC()
		sub.CurrentPeriodStart = &t
	}
	if strings.TrimSpace(req.CurrentPeriodEnd) != "" {
		parsed, err := time.Parse(time.RFC3339, req.CurrentPeriodEnd)
		if err != nil {
			return subscription{}, errors.New("current_period_end must be RFC3339")
		}
		t := parsed.UTC()
		sub.CurrentPeriodEnd = &t
	}
	return sub, nil
}

func normalizeInterval(interval string) string {
	s := strings.ToLower(strings.TrimSpace(interval))
	switch s {
	case "weekly", "monthly", "quarterly", "yearly":
		return s
	default:
		return ""
	}
}

func normalizeStatus(status string) string {
	s := strings.ToLower(strings.TrimSpace(status))
	switch s {
	case "active", "paused", "cancelled", "past_due", "trialing", "expired":
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
		`CREATE TABLE IF NOT EXISTS ecommerce_subscriptions (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			customer_id TEXT NOT NULL,
			plan_id TEXT NOT NULL,
			plan_name TEXT,
			interval TEXT CHECK (interval IN ('weekly','monthly','quarterly','yearly')) DEFAULT 'monthly',
			price NUMERIC(18,2) NOT NULL,
			currency TEXT DEFAULT 'USD',
			status TEXT CHECK (status IN ('active','paused','cancelled','past_due','trialing','expired')) DEFAULT 'trialing',
			trial_ends_at TIMESTAMPTZ,
			current_period_start TIMESTAMPTZ,
			current_period_end TIMESTAMPTZ,
			cancelled_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_created ON ecommerce_subscriptions (tenant_id, created_at DESC, id DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_customer ON ecommerce_subscriptions (tenant_id, customer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status ON ecommerce_subscriptions (tenant_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_plan ON ecommerce_subscriptions (tenant_id, plan_id)`,
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

func (s *service) createSubscription(ctx context.Context, sub subscription) error {
	if s.db == nil {
		s.memMu.Lock()
		s.memByID[sub.ID] = sub
		s.memMu.Unlock()
		s.invalidateTenantCache(sub.TenantID)
		return nil
	}
	q := `INSERT INTO ecommerce_subscriptions (id, tenant_id, customer_id, plan_id, plan_name, interval, price, currency, status, trial_ends_at, current_period_start, current_period_end, cancelled_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`
	if _, err := s.db.ExecContext(ctx, q,
		sub.ID, sub.TenantID, sub.CustomerID, sub.PlanID, nilIfEmpty(sub.PlanName),
		sub.Interval, sub.Price, sub.Currency, sub.Status,
		sub.TrialEndsAt, sub.CurrentPeriodStart, sub.CurrentPeriodEnd, sub.CancelledAt,
		sub.CreatedAt, sub.UpdatedAt,
	); err != nil {
		return err
	}
	s.invalidateTenantCache(sub.TenantID)
	return nil
}

// ---------------------------------------------------------------------------
// CRUD - Read
// ---------------------------------------------------------------------------

func (s *service) getByID(ctx context.Context, tenantID, id string) (subscription, error) {
	if s.db == nil {
		s.memMu.RLock()
		sub, ok := s.memByID[id]
		s.memMu.RUnlock()
		if !ok || sub.TenantID != tenantID {
			return subscription{}, sql.ErrNoRows
		}
		return sub, nil
	}

	q := `SELECT id, tenant_id, customer_id, plan_id, plan_name, interval, price, currency, status, trial_ends_at, current_period_start, current_period_end, cancelled_at, created_at, updated_at
		FROM ecommerce_subscriptions WHERE tenant_id=$1 AND id=$2`
	var sub subscription
	var planName sql.NullString
	var trialEnds, periodStart, periodEnd, cancelledAt sql.NullTime
	err := s.db.QueryRowContext(ctx, q, tenantID, id).Scan(
		&sub.ID, &sub.TenantID, &sub.CustomerID, &sub.PlanID, &planName,
		&sub.Interval, &sub.Price, &sub.Currency, &sub.Status,
		&trialEnds, &periodStart, &periodEnd, &cancelledAt,
		&sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		return subscription{}, err
	}
	sub.PlanName = planName.String
	if trialEnds.Valid {
		sub.TrialEndsAt = &trialEnds.Time
	}
	if periodStart.Valid {
		sub.CurrentPeriodStart = &periodStart.Time
	}
	if periodEnd.Valid {
		sub.CurrentPeriodEnd = &periodEnd.Time
	}
	if cancelledAt.Valid {
		sub.CancelledAt = &cancelledAt.Time
	}
	return sub, nil
}

// ---------------------------------------------------------------------------
// CRUD - List
// ---------------------------------------------------------------------------

func (s *service) listSubscriptions(ctx context.Context, tenantID, customerID, status, planID, cursor string, limit int) (listResponse, error) {
	if cursor == "" {
		if cached, ok := s.getListCache(tenantID, customerID, status, planID, cursor, limit); ok {
			cached.Cached = true
			return cached, nil
		}
	}

	if s.db == nil {
		resp := s.listSubscriptionsMemory(tenantID, customerID, status, planID, cursor, limit)
		if cursor == "" {
			s.setListCache(tenantID, customerID, status, planID, cursor, limit, resp)
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
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	if planID != "" {
		where = append(where, fmt.Sprintf("plan_id = $%d", nextArg))
		args = append(args, planID)
		nextArg++
	}
	if !cursorTime.IsZero() {
		where = append(where, fmt.Sprintf("(created_at, id) < ($%d, $%d)", nextArg, nextArg+1))
		args = append(args, cursorTime, cursorID)
		nextArg += 2
	}
	args = append(args, limit+1)
	q := fmt.Sprintf(`
		SELECT id, tenant_id, customer_id, plan_id, plan_name, interval, price, currency, status, trial_ends_at, current_period_start, current_period_end, cancelled_at, created_at, updated_at
		FROM ecommerce_subscriptions
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), nextArg)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return listResponse{}, err
	}
	defer rows.Close()

	items := make([]subscription, 0, limit)
	for rows.Next() {
		var sub subscription
		var pn sql.NullString
		var te, ps, pe, ca sql.NullTime
		if err := rows.Scan(&sub.ID, &sub.TenantID, &sub.CustomerID, &sub.PlanID, &pn,
			&sub.Interval, &sub.Price, &sub.Currency, &sub.Status,
			&te, &ps, &pe, &ca, &sub.CreatedAt, &sub.UpdatedAt); err != nil {
			return listResponse{}, err
		}
		sub.PlanName = pn.String
		if te.Valid {
			sub.TrialEndsAt = &te.Time
		}
		if ps.Valid {
			sub.CurrentPeriodStart = &ps.Time
		}
		if pe.Valid {
			sub.CurrentPeriodEnd = &pe.Time
		}
		if ca.Valid {
			sub.CancelledAt = &ca.Time
		}
		items = append(items, sub)
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
		s.setListCache(tenantID, customerID, status, planID, cursor, limit, resp)
	}
	return resp, nil
}

func (s *service) listSubscriptionsMemory(tenantID, customerID, status, planID, cursor string, limit int) listResponse {
	s.memMu.RLock()
	items := make([]subscription, 0)
	for _, sub := range s.memByID {
		if sub.TenantID != tenantID {
			continue
		}
		if customerID != "" && sub.CustomerID != customerID {
			continue
		}
		if status != "" && sub.Status != normalizeStatus(status) {
			continue
		}
		if planID != "" && sub.PlanID != planID {
			continue
		}
		items = append(items, sub)
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

func (s *service) updateSubscription(ctx context.Context, tenantID, id string, req updateSubscriptionRequest) (subscription, error) {
	if req.PlanID == nil && req.PlanName == nil && req.Interval == nil && req.Price == nil &&
		req.Currency == nil && req.Status == nil && req.CurrentPeriodStart == nil && req.CurrentPeriodEnd == nil {
		return subscription{}, errors.New("empty update payload")
	}

	if s.db == nil {
		s.memMu.Lock()
		sub, ok := s.memByID[id]
		if !ok || sub.TenantID != tenantID {
			s.memMu.Unlock()
			return subscription{}, sql.ErrNoRows
		}
		if req.PlanID != nil {
			sub.PlanID = strings.TrimSpace(*req.PlanID)
		}
		if req.PlanName != nil {
			sub.PlanName = strings.TrimSpace(*req.PlanName)
		}
		if req.Interval != nil {
			ni := normalizeInterval(*req.Interval)
			if ni == "" {
				s.memMu.Unlock()
				return subscription{}, errors.New("invalid interval")
			}
			sub.Interval = ni
		}
		if req.Price != nil {
			sub.Price = strings.TrimSpace(*req.Price)
		}
		if req.Currency != nil {
			sub.Currency = strings.ToUpper(strings.TrimSpace(*req.Currency))
		}
		if req.Status != nil {
			ns := normalizeStatus(*req.Status)
			if ns == "" {
				s.memMu.Unlock()
				return subscription{}, errors.New("invalid status")
			}
			sub.Status = ns
			if ns == "cancelled" {
				now := time.Now().UTC()
				sub.CancelledAt = &now
			}
		}
		if req.CurrentPeriodStart != nil {
			parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.CurrentPeriodStart))
			if err != nil {
				s.memMu.Unlock()
				return subscription{}, errors.New("current_period_start must be RFC3339")
			}
			t := parsed.UTC()
			sub.CurrentPeriodStart = &t
		}
		if req.CurrentPeriodEnd != nil {
			parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.CurrentPeriodEnd))
			if err != nil {
				s.memMu.Unlock()
				return subscription{}, errors.New("current_period_end must be RFC3339")
			}
			t := parsed.UTC()
			sub.CurrentPeriodEnd = &t
		}
		sub.UpdatedAt = time.Now().UTC()
		s.memByID[id] = sub
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return sub, nil
	}

	assignments := make([]string, 0, 9)
	args := []any{tenantID, id}
	next := 3
	if req.PlanID != nil {
		assignments = append(assignments, fmt.Sprintf("plan_id = $%d", next))
		args = append(args, strings.TrimSpace(*req.PlanID))
		next++
	}
	if req.PlanName != nil {
		assignments = append(assignments, fmt.Sprintf("plan_name = $%d", next))
		args = append(args, strings.TrimSpace(*req.PlanName))
		next++
	}
	if req.Interval != nil {
		ni := normalizeInterval(*req.Interval)
		if ni == "" {
			return subscription{}, errors.New("invalid interval")
		}
		assignments = append(assignments, fmt.Sprintf("interval = $%d", next))
		args = append(args, ni)
		next++
	}
	if req.Price != nil {
		assignments = append(assignments, fmt.Sprintf("price = $%d", next))
		args = append(args, strings.TrimSpace(*req.Price))
		next++
	}
	if req.Currency != nil {
		assignments = append(assignments, fmt.Sprintf("currency = $%d", next))
		args = append(args, strings.ToUpper(strings.TrimSpace(*req.Currency)))
		next++
	}
	if req.Status != nil {
		ns := normalizeStatus(*req.Status)
		if ns == "" {
			return subscription{}, errors.New("invalid status")
		}
		assignments = append(assignments, fmt.Sprintf("status = $%d", next))
		args = append(args, ns)
		next++
		if ns == "cancelled" {
			assignments = append(assignments, fmt.Sprintf("cancelled_at = $%d", next))
			args = append(args, time.Now().UTC())
			next++
		}
	}
	if req.CurrentPeriodStart != nil {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.CurrentPeriodStart))
		if err != nil {
			return subscription{}, errors.New("current_period_start must be RFC3339")
		}
		assignments = append(assignments, fmt.Sprintf("current_period_start = $%d", next))
		args = append(args, parsed.UTC())
		next++
	}
	if req.CurrentPeriodEnd != nil {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.CurrentPeriodEnd))
		if err != nil {
			return subscription{}, errors.New("current_period_end must be RFC3339")
		}
		assignments = append(assignments, fmt.Sprintf("current_period_end = $%d", next))
		args = append(args, parsed.UTC())
		next++
	}

	assignments = append(assignments, fmt.Sprintf("updated_at = $%d", next))
	args = append(args, time.Now().UTC())

	q := fmt.Sprintf(`UPDATE ecommerce_subscriptions SET %s WHERE tenant_id = $1 AND id = $2`, strings.Join(assignments, ", "))
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return subscription{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return subscription{}, err
	}
	if affected == 0 {
		return subscription{}, sql.ErrNoRows
	}
	s.invalidateTenantCache(tenantID)
	return s.getByID(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// CRUD - Delete
// ---------------------------------------------------------------------------

func (s *service) deleteSubscription(ctx context.Context, tenantID, id string) error {
	if s.db == nil {
		s.memMu.Lock()
		sub, ok := s.memByID[id]
		if !ok || sub.TenantID != tenantID {
			s.memMu.Unlock()
			return sql.ErrNoRows
		}
		delete(s.memByID, id)
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return nil
	}

	res, err := s.db.ExecContext(ctx, `DELETE FROM ecommerce_subscriptions WHERE tenant_id=$1 AND id=$2`, tenantID, id)
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

func (s *service) explainList(ctx context.Context, tenantID, customerID, status, planID string) (any, error) {
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
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	if planID != "" {
		where = append(where, fmt.Sprintf("plan_id = $%d", nextArg))
		args = append(args, planID)
		nextArg++
	}
	planQuery := fmt.Sprintf(`EXPLAIN (ANALYZE FALSE, FORMAT JSON)
		SELECT id, tenant_id, customer_id, plan_id, plan_name, interval, price, currency, status, trial_ends_at, current_period_start, current_period_end, cancelled_at, created_at, updated_at
		FROM ecommerce_subscriptions
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

func (s *service) getListCache(tenantID, customerID, status, planID, cursor string, limit int) (listResponse, bool) {
	key := cacheKey(tenantID, customerID, status, planID, cursor, limit)
	s.cacheMu.RLock()
	item, ok := s.listCache[key]
	s.cacheMu.RUnlock()
	if !ok || time.Now().After(item.Expires) {
		return listResponse{}, false
	}
	return item.Response, true
}

func (s *service) setListCache(tenantID, customerID, status, planID, cursor string, limit int, value listResponse) {
	key := cacheKey(tenantID, customerID, status, planID, cursor, limit)
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

func cacheKey(tenantID, customerID, status, planID, cursor string, limit int) string {
	return fmt.Sprintf("%s|%s|%s|%s|%s|%d", tenantID, customerID, normalizeStatus(status), planID, cursor, limit)
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
		return fmt.Sprintf("sub_%d", time.Now().UnixNano())
	}
	return "sub_" + hex.EncodeToString(buf)
}
