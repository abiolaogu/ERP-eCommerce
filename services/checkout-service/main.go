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

type checkout struct {
	ID                  string     `json:"id"`
	TenantID            string     `json:"tenant_id"`
	CartID              string     `json:"cart_id"`
	CustomerID          string     `json:"customer_id,omitempty"`
	CustomerEmail       string     `json:"customer_email,omitempty"`
	ItemsJSON           string     `json:"items_json,omitempty"`
	Subtotal            string     `json:"subtotal,omitempty"`
	Tax                 string     `json:"tax,omitempty"`
	Shipping            string     `json:"shipping,omitempty"`
	Discount            string     `json:"discount,omitempty"`
	Total               string     `json:"total,omitempty"`
	Currency            string     `json:"currency"`
	ShippingAddressJSON string     `json:"shipping_address_json,omitempty"`
	BillingAddressJSON  string     `json:"billing_address_json,omitempty"`
	PaymentMethod       string     `json:"payment_method,omitempty"`
	Status              string     `json:"status"`
	CompletedAt         *time.Time `json:"completed_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type createCheckoutRequest struct {
	CartID              string `json:"cart_id"`
	CustomerID          string `json:"customer_id"`
	CustomerEmail       string `json:"customer_email"`
	ItemsJSON           string `json:"items_json"`
	Subtotal            string `json:"subtotal"`
	Tax                 string `json:"tax"`
	Shipping            string `json:"shipping"`
	Discount            string `json:"discount"`
	Total               string `json:"total"`
	Currency            string `json:"currency"`
	ShippingAddressJSON string `json:"shipping_address_json"`
	BillingAddressJSON  string `json:"billing_address_json"`
	PaymentMethod       string `json:"payment_method"`
	Status              string `json:"status"`
}

type updateCheckoutRequest struct {
	CustomerID          *string `json:"customer_id,omitempty"`
	CustomerEmail       *string `json:"customer_email,omitempty"`
	ItemsJSON           *string `json:"items_json,omitempty"`
	Subtotal            *string `json:"subtotal,omitempty"`
	Tax                 *string `json:"tax,omitempty"`
	Shipping            *string `json:"shipping,omitempty"`
	Discount            *string `json:"discount,omitempty"`
	Total               *string `json:"total,omitempty"`
	Currency            *string `json:"currency,omitempty"`
	ShippingAddressJSON *string `json:"shipping_address_json,omitempty"`
	BillingAddressJSON  *string `json:"billing_address_json,omitempty"`
	PaymentMethod       *string `json:"payment_method,omitempty"`
	Status              *string `json:"status,omitempty"`
}

type listResponse struct {
	Items      []checkout `json:"items"`
	NextCursor string     `json:"next_cursor,omitempty"`
	Cached     bool       `json:"cached"`
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
	memByID   map[string]checkout
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
		memByID:   make(map[string]checkout),
	}

	if db, err := connectDB(); err != nil {
		log.Printf("warn: database unavailable, running checkout in memory mode: %v", err)
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
		writeJSON(w, http.StatusOK, map[string]any{"status": "healthy", "module": module, "service": "checkout-service", "mode": mode})
	})

	base := "/v1/checkouts"

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
		plan, err := svc.explainList(r.Context(), tenantID, customerID, status)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"plan": plan, "event_topic": "erp.ecommerce.checkout.explain.generated"})
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
			resp, err := svc.listCheckouts(r.Context(), tenantID, customerID, status, cursor, limit)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": resp.Items, "next_cursor": resp.NextCursor, "cached": resp.Cached, "event_topic": "erp.ecommerce.checkout.listed"})
		case http.MethodPost:
			var req createCheckoutRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			co, err := buildCreateCheckout(tenantID, req)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			if err := svc.createCheckout(r.Context(), co); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"item": co, "event_topic": "erp.ecommerce.checkout.created"})
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
			co, err := svc.getByID(r.Context(), tenantID, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "checkout not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": co, "event_topic": "erp.ecommerce.checkout.read"})
		case http.MethodPut, http.MethodPatch:
			var req updateCheckoutRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			updated, err := svc.updateCheckout(r.Context(), tenantID, id, req)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "checkout not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": updated, "event_topic": "erp.ecommerce.checkout.updated"})
		case http.MethodDelete:
			if err := svc.deleteCheckout(r.Context(), tenantID, id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "checkout not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "event_topic": "erp.ecommerce.checkout.deleted"})
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

	log.Printf("checkout-service listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}

// ---------------------------------------------------------------------------
// Build / Validate
// ---------------------------------------------------------------------------

func buildCreateCheckout(tenantID string, req createCheckoutRequest) (checkout, error) {
	if strings.TrimSpace(req.CartID) == "" {
		return checkout{}, errors.New("cart_id is required")
	}
	status := normalizeStatus(req.Status)
	if status == "" {
		status = "initiated"
	}
	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "USD"
	}
	now := time.Now().UTC()
	return checkout{
		ID:                  newID(),
		TenantID:            tenantID,
		CartID:              strings.TrimSpace(req.CartID),
		CustomerID:          strings.TrimSpace(req.CustomerID),
		CustomerEmail:       strings.TrimSpace(req.CustomerEmail),
		ItemsJSON:           req.ItemsJSON,
		Subtotal:            strings.TrimSpace(req.Subtotal),
		Tax:                 strings.TrimSpace(req.Tax),
		Shipping:            strings.TrimSpace(req.Shipping),
		Discount:            strings.TrimSpace(req.Discount),
		Total:               strings.TrimSpace(req.Total),
		Currency:            currency,
		ShippingAddressJSON: req.ShippingAddressJSON,
		BillingAddressJSON:  req.BillingAddressJSON,
		PaymentMethod:       strings.TrimSpace(req.PaymentMethod),
		Status:              status,
		CreatedAt:           now,
		UpdatedAt:           now,
	}, nil
}

func normalizeStatus(status string) string {
	s := strings.ToLower(strings.TrimSpace(status))
	switch s {
	case "initiated", "pending", "processing", "completed", "abandoned", "failed":
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
		`CREATE TABLE IF NOT EXISTS ecommerce_checkouts (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			cart_id TEXT NOT NULL,
			customer_id TEXT,
			customer_email TEXT,
			items_json TEXT,
			subtotal NUMERIC(18,2),
			tax NUMERIC(18,2) DEFAULT 0,
			shipping NUMERIC(18,2) DEFAULT 0,
			discount NUMERIC(18,2) DEFAULT 0,
			total NUMERIC(18,2),
			currency TEXT DEFAULT 'USD',
			shipping_address_json TEXT,
			billing_address_json TEXT,
			payment_method TEXT,
			status TEXT CHECK (status IN ('initiated','pending','processing','completed','abandoned','failed')) DEFAULT 'initiated',
			completed_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_checkouts_tenant_created ON ecommerce_checkouts (tenant_id, created_at DESC, id DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_checkouts_tenant_customer ON ecommerce_checkouts (tenant_id, customer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_checkouts_tenant_status ON ecommerce_checkouts (tenant_id, status)`,
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

func (s *service) createCheckout(ctx context.Context, co checkout) error {
	if s.db == nil {
		s.memMu.Lock()
		s.memByID[co.ID] = co
		s.memMu.Unlock()
		s.invalidateTenantCache(co.TenantID)
		return nil
	}
	q := `INSERT INTO ecommerce_checkouts (id, tenant_id, cart_id, customer_id, customer_email, items_json, subtotal, tax, shipping, discount, total, currency, shipping_address_json, billing_address_json, payment_method, status, completed_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`
	var subtotal, tax, ship, disc, total sql.NullString
	if co.Subtotal != "" {
		subtotal = sql.NullString{String: co.Subtotal, Valid: true}
	}
	if co.Tax != "" {
		tax = sql.NullString{String: co.Tax, Valid: true}
	}
	if co.Shipping != "" {
		ship = sql.NullString{String: co.Shipping, Valid: true}
	}
	if co.Discount != "" {
		disc = sql.NullString{String: co.Discount, Valid: true}
	}
	if co.Total != "" {
		total = sql.NullString{String: co.Total, Valid: true}
	}
	if _, err := s.db.ExecContext(ctx, q,
		co.ID, co.TenantID, co.CartID, nilIfEmpty(co.CustomerID), nilIfEmpty(co.CustomerEmail),
		nilIfEmpty(co.ItemsJSON), subtotal, tax, ship, disc, total,
		co.Currency, nilIfEmpty(co.ShippingAddressJSON), nilIfEmpty(co.BillingAddressJSON),
		nilIfEmpty(co.PaymentMethod), co.Status, co.CompletedAt, co.CreatedAt, co.UpdatedAt,
	); err != nil {
		return err
	}
	s.invalidateTenantCache(co.TenantID)
	return nil
}

// ---------------------------------------------------------------------------
// CRUD - Read
// ---------------------------------------------------------------------------

func (s *service) getByID(ctx context.Context, tenantID, id string) (checkout, error) {
	if s.db == nil {
		s.memMu.RLock()
		co, ok := s.memByID[id]
		s.memMu.RUnlock()
		if !ok || co.TenantID != tenantID {
			return checkout{}, sql.ErrNoRows
		}
		return co, nil
	}

	q := `SELECT id, tenant_id, cart_id, customer_id, customer_email, items_json, subtotal, tax, shipping, discount, total, currency, shipping_address_json, billing_address_json, payment_method, status, completed_at, created_at, updated_at
		FROM ecommerce_checkouts WHERE tenant_id=$1 AND id=$2`
	var co checkout
	var customerID, customerEmail, itemsJSON, subtotal, tax, ship, disc, total, shippingAddr, billingAddr, paymentMethod sql.NullString
	var completedAt sql.NullTime
	err := s.db.QueryRowContext(ctx, q, tenantID, id).Scan(
		&co.ID, &co.TenantID, &co.CartID, &customerID, &customerEmail,
		&itemsJSON, &subtotal, &tax, &ship, &disc, &total,
		&co.Currency, &shippingAddr, &billingAddr, &paymentMethod,
		&co.Status, &completedAt, &co.CreatedAt, &co.UpdatedAt,
	)
	if err != nil {
		return checkout{}, err
	}
	co.CustomerID = customerID.String
	co.CustomerEmail = customerEmail.String
	co.ItemsJSON = itemsJSON.String
	co.Subtotal = subtotal.String
	co.Tax = tax.String
	co.Shipping = ship.String
	co.Discount = disc.String
	co.Total = total.String
	co.ShippingAddressJSON = shippingAddr.String
	co.BillingAddressJSON = billingAddr.String
	co.PaymentMethod = paymentMethod.String
	if completedAt.Valid {
		co.CompletedAt = &completedAt.Time
	}
	return co, nil
}

// ---------------------------------------------------------------------------
// CRUD - List
// ---------------------------------------------------------------------------

func (s *service) listCheckouts(ctx context.Context, tenantID, customerID, status, cursor string, limit int) (listResponse, error) {
	if cursor == "" {
		if cached, ok := s.getListCache(tenantID, customerID, status, cursor, limit); ok {
			cached.Cached = true
			return cached, nil
		}
	}

	if s.db == nil {
		resp := s.listCheckoutsMemory(tenantID, customerID, status, cursor, limit)
		if cursor == "" {
			s.setListCache(tenantID, customerID, status, cursor, limit, resp)
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
	if !cursorTime.IsZero() {
		where = append(where, fmt.Sprintf("(created_at, id) < ($%d, $%d)", nextArg, nextArg+1))
		args = append(args, cursorTime, cursorID)
		nextArg += 2
	}
	args = append(args, limit+1)
	q := fmt.Sprintf(`
		SELECT id, tenant_id, cart_id, customer_id, customer_email, items_json, subtotal, tax, shipping, discount, total, currency, shipping_address_json, billing_address_json, payment_method, status, completed_at, created_at, updated_at
		FROM ecommerce_checkouts
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), nextArg)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return listResponse{}, err
	}
	defer rows.Close()

	items := make([]checkout, 0, limit)
	for rows.Next() {
		var co checkout
		var cid, cemail, ijson, sub, tx, sh, di, tot, saJSON, baJSON, pm sql.NullString
		var compAt sql.NullTime
		if err := rows.Scan(&co.ID, &co.TenantID, &co.CartID, &cid, &cemail, &ijson, &sub, &tx, &sh, &di, &tot, &co.Currency, &saJSON, &baJSON, &pm, &co.Status, &compAt, &co.CreatedAt, &co.UpdatedAt); err != nil {
			return listResponse{}, err
		}
		co.CustomerID = cid.String
		co.CustomerEmail = cemail.String
		co.ItemsJSON = ijson.String
		co.Subtotal = sub.String
		co.Tax = tx.String
		co.Shipping = sh.String
		co.Discount = di.String
		co.Total = tot.String
		co.ShippingAddressJSON = saJSON.String
		co.BillingAddressJSON = baJSON.String
		co.PaymentMethod = pm.String
		if compAt.Valid {
			co.CompletedAt = &compAt.Time
		}
		items = append(items, co)
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
		s.setListCache(tenantID, customerID, status, cursor, limit, resp)
	}
	return resp, nil
}

func (s *service) listCheckoutsMemory(tenantID, customerID, status, cursor string, limit int) listResponse {
	s.memMu.RLock()
	items := make([]checkout, 0)
	for _, co := range s.memByID {
		if co.TenantID != tenantID {
			continue
		}
		if customerID != "" && co.CustomerID != customerID {
			continue
		}
		if status != "" && co.Status != normalizeStatus(status) {
			continue
		}
		items = append(items, co)
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

func (s *service) updateCheckout(ctx context.Context, tenantID, id string, req updateCheckoutRequest) (checkout, error) {
	if req.CustomerID == nil && req.CustomerEmail == nil && req.ItemsJSON == nil &&
		req.Subtotal == nil && req.Tax == nil && req.Shipping == nil && req.Discount == nil &&
		req.Total == nil && req.Currency == nil && req.ShippingAddressJSON == nil &&
		req.BillingAddressJSON == nil && req.PaymentMethod == nil && req.Status == nil {
		return checkout{}, errors.New("empty update payload")
	}

	if s.db == nil {
		s.memMu.Lock()
		co, ok := s.memByID[id]
		if !ok || co.TenantID != tenantID {
			s.memMu.Unlock()
			return checkout{}, sql.ErrNoRows
		}
		if req.CustomerID != nil {
			co.CustomerID = strings.TrimSpace(*req.CustomerID)
		}
		if req.CustomerEmail != nil {
			co.CustomerEmail = strings.TrimSpace(*req.CustomerEmail)
		}
		if req.ItemsJSON != nil {
			co.ItemsJSON = *req.ItemsJSON
		}
		if req.Subtotal != nil {
			co.Subtotal = strings.TrimSpace(*req.Subtotal)
		}
		if req.Tax != nil {
			co.Tax = strings.TrimSpace(*req.Tax)
		}
		if req.Shipping != nil {
			co.Shipping = strings.TrimSpace(*req.Shipping)
		}
		if req.Discount != nil {
			co.Discount = strings.TrimSpace(*req.Discount)
		}
		if req.Total != nil {
			co.Total = strings.TrimSpace(*req.Total)
		}
		if req.Currency != nil {
			co.Currency = strings.ToUpper(strings.TrimSpace(*req.Currency))
		}
		if req.ShippingAddressJSON != nil {
			co.ShippingAddressJSON = *req.ShippingAddressJSON
		}
		if req.BillingAddressJSON != nil {
			co.BillingAddressJSON = *req.BillingAddressJSON
		}
		if req.PaymentMethod != nil {
			co.PaymentMethod = strings.TrimSpace(*req.PaymentMethod)
		}
		if req.Status != nil {
			ns := normalizeStatus(*req.Status)
			if ns == "" {
				s.memMu.Unlock()
				return checkout{}, errors.New("invalid status")
			}
			co.Status = ns
			if ns == "completed" {
				now := time.Now().UTC()
				co.CompletedAt = &now
			}
		}
		co.UpdatedAt = time.Now().UTC()
		s.memByID[id] = co
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return co, nil
	}

	assignments := make([]string, 0, 14)
	args := []any{tenantID, id}
	next := 3
	if req.CustomerID != nil {
		assignments = append(assignments, fmt.Sprintf("customer_id = $%d", next))
		args = append(args, strings.TrimSpace(*req.CustomerID))
		next++
	}
	if req.CustomerEmail != nil {
		assignments = append(assignments, fmt.Sprintf("customer_email = $%d", next))
		args = append(args, strings.TrimSpace(*req.CustomerEmail))
		next++
	}
	if req.ItemsJSON != nil {
		assignments = append(assignments, fmt.Sprintf("items_json = $%d", next))
		args = append(args, *req.ItemsJSON)
		next++
	}
	if req.Subtotal != nil {
		assignments = append(assignments, fmt.Sprintf("subtotal = $%d", next))
		args = append(args, strings.TrimSpace(*req.Subtotal))
		next++
	}
	if req.Tax != nil {
		assignments = append(assignments, fmt.Sprintf("tax = $%d", next))
		args = append(args, strings.TrimSpace(*req.Tax))
		next++
	}
	if req.Shipping != nil {
		assignments = append(assignments, fmt.Sprintf("shipping = $%d", next))
		args = append(args, strings.TrimSpace(*req.Shipping))
		next++
	}
	if req.Discount != nil {
		assignments = append(assignments, fmt.Sprintf("discount = $%d", next))
		args = append(args, strings.TrimSpace(*req.Discount))
		next++
	}
	if req.Total != nil {
		assignments = append(assignments, fmt.Sprintf("total = $%d", next))
		args = append(args, strings.TrimSpace(*req.Total))
		next++
	}
	if req.Currency != nil {
		assignments = append(assignments, fmt.Sprintf("currency = $%d", next))
		args = append(args, strings.ToUpper(strings.TrimSpace(*req.Currency)))
		next++
	}
	if req.ShippingAddressJSON != nil {
		assignments = append(assignments, fmt.Sprintf("shipping_address_json = $%d", next))
		args = append(args, *req.ShippingAddressJSON)
		next++
	}
	if req.BillingAddressJSON != nil {
		assignments = append(assignments, fmt.Sprintf("billing_address_json = $%d", next))
		args = append(args, *req.BillingAddressJSON)
		next++
	}
	if req.PaymentMethod != nil {
		assignments = append(assignments, fmt.Sprintf("payment_method = $%d", next))
		args = append(args, strings.TrimSpace(*req.PaymentMethod))
		next++
	}
	if req.Status != nil {
		ns := normalizeStatus(*req.Status)
		if ns == "" {
			return checkout{}, errors.New("invalid status")
		}
		assignments = append(assignments, fmt.Sprintf("status = $%d", next))
		args = append(args, ns)
		next++
		if ns == "completed" {
			assignments = append(assignments, fmt.Sprintf("completed_at = $%d", next))
			args = append(args, time.Now().UTC())
			next++
		}
	}

	assignments = append(assignments, fmt.Sprintf("updated_at = $%d", next))
	args = append(args, time.Now().UTC())

	q := fmt.Sprintf(`UPDATE ecommerce_checkouts SET %s WHERE tenant_id = $1 AND id = $2`, strings.Join(assignments, ", "))
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return checkout{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return checkout{}, err
	}
	if affected == 0 {
		return checkout{}, sql.ErrNoRows
	}
	s.invalidateTenantCache(tenantID)
	return s.getByID(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// CRUD - Delete
// ---------------------------------------------------------------------------

func (s *service) deleteCheckout(ctx context.Context, tenantID, id string) error {
	if s.db == nil {
		s.memMu.Lock()
		co, ok := s.memByID[id]
		if !ok || co.TenantID != tenantID {
			s.memMu.Unlock()
			return sql.ErrNoRows
		}
		delete(s.memByID, id)
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return nil
	}

	res, err := s.db.ExecContext(ctx, `DELETE FROM ecommerce_checkouts WHERE tenant_id=$1 AND id=$2`, tenantID, id)
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

func (s *service) explainList(ctx context.Context, tenantID, customerID, status string) (any, error) {
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
	planQuery := fmt.Sprintf(`EXPLAIN (ANALYZE FALSE, FORMAT JSON)
		SELECT id, tenant_id, cart_id, customer_id, customer_email, items_json, subtotal, tax, shipping, discount, total, currency, shipping_address_json, billing_address_json, payment_method, status, completed_at, created_at, updated_at
		FROM ecommerce_checkouts
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

func (s *service) getListCache(tenantID, customerID, status, cursor string, limit int) (listResponse, bool) {
	key := cacheKey(tenantID, customerID, status, cursor, limit)
	s.cacheMu.RLock()
	item, ok := s.listCache[key]
	s.cacheMu.RUnlock()
	if !ok || time.Now().After(item.Expires) {
		return listResponse{}, false
	}
	return item.Response, true
}

func (s *service) setListCache(tenantID, customerID, status, cursor string, limit int, value listResponse) {
	key := cacheKey(tenantID, customerID, status, cursor, limit)
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

func cacheKey(tenantID, customerID, status, cursor string, limit int) string {
	return fmt.Sprintf("%s|%s|%s|%s|%d", tenantID, customerID, normalizeStatus(status), cursor, limit)
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
		return fmt.Sprintf("co_%d", time.Now().UnixNano())
	}
	return "co_" + hex.EncodeToString(buf)
}
