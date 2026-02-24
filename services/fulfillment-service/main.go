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

type fulfillment struct {
	ID             string     `json:"id"`
	TenantID       string     `json:"tenant_id"`
	OrderID        string     `json:"order_id"`
	WarehouseID    string     `json:"warehouse_id,omitempty"`
	TrackingNumber string     `json:"tracking_number,omitempty"`
	Carrier        string     `json:"carrier,omitempty"`
	ServiceType    string     `json:"service_type,omitempty"`
	ItemsJSON      string     `json:"items_json,omitempty"`
	Status         string     `json:"status"`
	ShippedAt      *time.Time `json:"shipped_at,omitempty"`
	DeliveredAt    *time.Time `json:"delivered_at,omitempty"`
	Notes          string     `json:"notes,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type createFulfillmentRequest struct {
	OrderID        string `json:"order_id"`
	WarehouseID    string `json:"warehouse_id"`
	TrackingNumber string `json:"tracking_number"`
	Carrier        string `json:"carrier"`
	ServiceType    string `json:"service_type"`
	ItemsJSON      string `json:"items_json"`
	Status         string `json:"status"`
	Notes          string `json:"notes"`
}

type updateFulfillmentRequest struct {
	WarehouseID    *string `json:"warehouse_id,omitempty"`
	TrackingNumber *string `json:"tracking_number,omitempty"`
	Carrier        *string `json:"carrier,omitempty"`
	ServiceType    *string `json:"service_type,omitempty"`
	ItemsJSON      *string `json:"items_json,omitempty"`
	Status         *string `json:"status,omitempty"`
	Notes          *string `json:"notes,omitempty"`
}

type listResponse struct {
	Items      []fulfillment `json:"items"`
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
	memByID   map[string]fulfillment
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
		memByID:   make(map[string]fulfillment),
	}

	if db, err := connectDB(); err != nil {
		log.Printf("warn: database unavailable, running fulfillment in memory mode: %v", err)
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
		writeJSON(w, http.StatusOK, map[string]any{"status": "healthy", "module": module, "service": "fulfillment-service", "mode": mode})
	})

	base := "/v1/fulfillments"

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
		orderID := strings.TrimSpace(r.URL.Query().Get("order_id"))
		status := strings.TrimSpace(r.URL.Query().Get("status"))
		carrier := strings.TrimSpace(r.URL.Query().Get("carrier"))
		plan, err := svc.explainList(r.Context(), tenantID, orderID, status, carrier)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"plan": plan, "event_topic": "erp.ecommerce.fulfillment.explain.generated"})
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
			orderID := strings.TrimSpace(r.URL.Query().Get("order_id"))
			status := strings.TrimSpace(r.URL.Query().Get("status"))
			carrier := strings.TrimSpace(r.URL.Query().Get("carrier"))
			resp, err := svc.listFulfillments(r.Context(), tenantID, orderID, status, carrier, cursor, limit)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": resp.Items, "next_cursor": resp.NextCursor, "cached": resp.Cached, "event_topic": "erp.ecommerce.fulfillment.listed"})
		case http.MethodPost:
			var req createFulfillmentRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			ff, err := buildCreateFulfillment(tenantID, req)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			if err := svc.createFulfillment(r.Context(), ff); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"item": ff, "event_topic": "erp.ecommerce.fulfillment.created"})
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
			ff, err := svc.getByID(r.Context(), tenantID, id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "fulfillment not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": ff, "event_topic": "erp.ecommerce.fulfillment.read"})
		case http.MethodPut, http.MethodPatch:
			var req updateFulfillmentRequest
			if err := decodeJSON(r, &req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			updated, err := svc.updateFulfillment(r.Context(), tenantID, id, req)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "fulfillment not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"item": updated, "event_topic": "erp.ecommerce.fulfillment.updated"})
		case http.MethodDelete:
			if err := svc.deleteFulfillment(r.Context(), tenantID, id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "fulfillment not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "event_topic": "erp.ecommerce.fulfillment.deleted"})
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

	log.Printf("fulfillment-service listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}

// ---------------------------------------------------------------------------
// Build / Validate
// ---------------------------------------------------------------------------

func buildCreateFulfillment(tenantID string, req createFulfillmentRequest) (fulfillment, error) {
	if strings.TrimSpace(req.OrderID) == "" {
		return fulfillment{}, errors.New("order_id is required")
	}
	status := normalizeStatus(req.Status)
	if status == "" {
		status = "pending"
	}
	now := time.Now().UTC()
	return fulfillment{
		ID:             newID(),
		TenantID:       tenantID,
		OrderID:        strings.TrimSpace(req.OrderID),
		WarehouseID:    strings.TrimSpace(req.WarehouseID),
		TrackingNumber: strings.TrimSpace(req.TrackingNumber),
		Carrier:        strings.TrimSpace(req.Carrier),
		ServiceType:    strings.TrimSpace(req.ServiceType),
		ItemsJSON:      req.ItemsJSON,
		Status:         status,
		Notes:          strings.TrimSpace(req.Notes),
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

func normalizeStatus(status string) string {
	s := strings.ToLower(strings.TrimSpace(status))
	switch s {
	case "pending", "processing", "picked", "packed", "shipped", "delivered", "cancelled", "returned":
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
		`CREATE TABLE IF NOT EXISTS ecommerce_fulfillments (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			order_id TEXT NOT NULL,
			warehouse_id TEXT,
			tracking_number TEXT,
			carrier TEXT,
			service_type TEXT,
			items_json TEXT,
			status TEXT CHECK (status IN ('pending','processing','picked','packed','shipped','delivered','cancelled','returned')) DEFAULT 'pending',
			shipped_at TIMESTAMPTZ,
			delivered_at TIMESTAMPTZ,
			notes TEXT,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_fulfillments_tenant_created ON ecommerce_fulfillments (tenant_id, created_at DESC, id DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_fulfillments_tenant_order ON ecommerce_fulfillments (tenant_id, order_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fulfillments_tenant_status ON ecommerce_fulfillments (tenant_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_fulfillments_tenant_carrier ON ecommerce_fulfillments (tenant_id, carrier)`,
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

func (s *service) createFulfillment(ctx context.Context, ff fulfillment) error {
	if s.db == nil {
		s.memMu.Lock()
		s.memByID[ff.ID] = ff
		s.memMu.Unlock()
		s.invalidateTenantCache(ff.TenantID)
		return nil
	}
	q := `INSERT INTO ecommerce_fulfillments (id, tenant_id, order_id, warehouse_id, tracking_number, carrier, service_type, items_json, status, shipped_at, delivered_at, notes, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`
	if _, err := s.db.ExecContext(ctx, q,
		ff.ID, ff.TenantID, ff.OrderID, nilIfEmpty(ff.WarehouseID), nilIfEmpty(ff.TrackingNumber),
		nilIfEmpty(ff.Carrier), nilIfEmpty(ff.ServiceType), nilIfEmpty(ff.ItemsJSON),
		ff.Status, ff.ShippedAt, ff.DeliveredAt, nilIfEmpty(ff.Notes),
		ff.CreatedAt, ff.UpdatedAt,
	); err != nil {
		return err
	}
	s.invalidateTenantCache(ff.TenantID)
	return nil
}

// ---------------------------------------------------------------------------
// CRUD - Read
// ---------------------------------------------------------------------------

func (s *service) getByID(ctx context.Context, tenantID, id string) (fulfillment, error) {
	if s.db == nil {
		s.memMu.RLock()
		ff, ok := s.memByID[id]
		s.memMu.RUnlock()
		if !ok || ff.TenantID != tenantID {
			return fulfillment{}, sql.ErrNoRows
		}
		return ff, nil
	}

	q := `SELECT id, tenant_id, order_id, warehouse_id, tracking_number, carrier, service_type, items_json, status, shipped_at, delivered_at, notes, created_at, updated_at
		FROM ecommerce_fulfillments WHERE tenant_id=$1 AND id=$2`
	var ff fulfillment
	var warehouseID, trackingNum, carrier, serviceType, itemsJSON, notes sql.NullString
	var shippedAt, deliveredAt sql.NullTime
	err := s.db.QueryRowContext(ctx, q, tenantID, id).Scan(
		&ff.ID, &ff.TenantID, &ff.OrderID, &warehouseID, &trackingNum,
		&carrier, &serviceType, &itemsJSON, &ff.Status,
		&shippedAt, &deliveredAt, &notes, &ff.CreatedAt, &ff.UpdatedAt,
	)
	if err != nil {
		return fulfillment{}, err
	}
	ff.WarehouseID = warehouseID.String
	ff.TrackingNumber = trackingNum.String
	ff.Carrier = carrier.String
	ff.ServiceType = serviceType.String
	ff.ItemsJSON = itemsJSON.String
	ff.Notes = notes.String
	if shippedAt.Valid {
		ff.ShippedAt = &shippedAt.Time
	}
	if deliveredAt.Valid {
		ff.DeliveredAt = &deliveredAt.Time
	}
	return ff, nil
}

// ---------------------------------------------------------------------------
// CRUD - List
// ---------------------------------------------------------------------------

func (s *service) listFulfillments(ctx context.Context, tenantID, orderID, status, carrier, cursor string, limit int) (listResponse, error) {
	if cursor == "" {
		if cached, ok := s.getListCache(tenantID, orderID, status, carrier, cursor, limit); ok {
			cached.Cached = true
			return cached, nil
		}
	}

	if s.db == nil {
		resp := s.listFulfillmentsMemory(tenantID, orderID, status, carrier, cursor, limit)
		if cursor == "" {
			s.setListCache(tenantID, orderID, status, carrier, cursor, limit, resp)
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
	if orderID != "" {
		where = append(where, fmt.Sprintf("order_id = $%d", nextArg))
		args = append(args, orderID)
		nextArg++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	if carrier != "" {
		where = append(where, fmt.Sprintf("carrier = $%d", nextArg))
		args = append(args, carrier)
		nextArg++
	}
	if !cursorTime.IsZero() {
		where = append(where, fmt.Sprintf("(created_at, id) < ($%d, $%d)", nextArg, nextArg+1))
		args = append(args, cursorTime, cursorID)
		nextArg += 2
	}
	args = append(args, limit+1)
	q := fmt.Sprintf(`
		SELECT id, tenant_id, order_id, warehouse_id, tracking_number, carrier, service_type, items_json, status, shipped_at, delivered_at, notes, created_at, updated_at
		FROM ecommerce_fulfillments
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), nextArg)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return listResponse{}, err
	}
	defer rows.Close()

	items := make([]fulfillment, 0, limit)
	for rows.Next() {
		var ff fulfillment
		var wid, tn, cr, st, ij, nt sql.NullString
		var sa, da sql.NullTime
		if err := rows.Scan(&ff.ID, &ff.TenantID, &ff.OrderID, &wid, &tn, &cr, &st, &ij, &ff.Status, &sa, &da, &nt, &ff.CreatedAt, &ff.UpdatedAt); err != nil {
			return listResponse{}, err
		}
		ff.WarehouseID = wid.String
		ff.TrackingNumber = tn.String
		ff.Carrier = cr.String
		ff.ServiceType = st.String
		ff.ItemsJSON = ij.String
		ff.Notes = nt.String
		if sa.Valid {
			ff.ShippedAt = &sa.Time
		}
		if da.Valid {
			ff.DeliveredAt = &da.Time
		}
		items = append(items, ff)
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
		s.setListCache(tenantID, orderID, status, carrier, cursor, limit, resp)
	}
	return resp, nil
}

func (s *service) listFulfillmentsMemory(tenantID, orderID, status, carrier, cursor string, limit int) listResponse {
	s.memMu.RLock()
	items := make([]fulfillment, 0)
	for _, ff := range s.memByID {
		if ff.TenantID != tenantID {
			continue
		}
		if orderID != "" && ff.OrderID != orderID {
			continue
		}
		if status != "" && ff.Status != normalizeStatus(status) {
			continue
		}
		if carrier != "" && ff.Carrier != carrier {
			continue
		}
		items = append(items, ff)
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

func (s *service) updateFulfillment(ctx context.Context, tenantID, id string, req updateFulfillmentRequest) (fulfillment, error) {
	if req.WarehouseID == nil && req.TrackingNumber == nil && req.Carrier == nil &&
		req.ServiceType == nil && req.ItemsJSON == nil && req.Status == nil && req.Notes == nil {
		return fulfillment{}, errors.New("empty update payload")
	}

	if s.db == nil {
		s.memMu.Lock()
		ff, ok := s.memByID[id]
		if !ok || ff.TenantID != tenantID {
			s.memMu.Unlock()
			return fulfillment{}, sql.ErrNoRows
		}
		if req.WarehouseID != nil {
			ff.WarehouseID = strings.TrimSpace(*req.WarehouseID)
		}
		if req.TrackingNumber != nil {
			ff.TrackingNumber = strings.TrimSpace(*req.TrackingNumber)
		}
		if req.Carrier != nil {
			ff.Carrier = strings.TrimSpace(*req.Carrier)
		}
		if req.ServiceType != nil {
			ff.ServiceType = strings.TrimSpace(*req.ServiceType)
		}
		if req.ItemsJSON != nil {
			ff.ItemsJSON = *req.ItemsJSON
		}
		if req.Status != nil {
			ns := normalizeStatus(*req.Status)
			if ns == "" {
				s.memMu.Unlock()
				return fulfillment{}, errors.New("invalid status")
			}
			ff.Status = ns
			now := time.Now().UTC()
			if ns == "shipped" {
				ff.ShippedAt = &now
			}
			if ns == "delivered" {
				ff.DeliveredAt = &now
			}
		}
		if req.Notes != nil {
			ff.Notes = strings.TrimSpace(*req.Notes)
		}
		ff.UpdatedAt = time.Now().UTC()
		s.memByID[id] = ff
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return ff, nil
	}

	assignments := make([]string, 0, 8)
	args := []any{tenantID, id}
	next := 3
	if req.WarehouseID != nil {
		assignments = append(assignments, fmt.Sprintf("warehouse_id = $%d", next))
		args = append(args, strings.TrimSpace(*req.WarehouseID))
		next++
	}
	if req.TrackingNumber != nil {
		assignments = append(assignments, fmt.Sprintf("tracking_number = $%d", next))
		args = append(args, strings.TrimSpace(*req.TrackingNumber))
		next++
	}
	if req.Carrier != nil {
		assignments = append(assignments, fmt.Sprintf("carrier = $%d", next))
		args = append(args, strings.TrimSpace(*req.Carrier))
		next++
	}
	if req.ServiceType != nil {
		assignments = append(assignments, fmt.Sprintf("service_type = $%d", next))
		args = append(args, strings.TrimSpace(*req.ServiceType))
		next++
	}
	if req.ItemsJSON != nil {
		assignments = append(assignments, fmt.Sprintf("items_json = $%d", next))
		args = append(args, *req.ItemsJSON)
		next++
	}
	if req.Status != nil {
		ns := normalizeStatus(*req.Status)
		if ns == "" {
			return fulfillment{}, errors.New("invalid status")
		}
		assignments = append(assignments, fmt.Sprintf("status = $%d", next))
		args = append(args, ns)
		next++
		if ns == "shipped" {
			assignments = append(assignments, fmt.Sprintf("shipped_at = $%d", next))
			args = append(args, time.Now().UTC())
			next++
		}
		if ns == "delivered" {
			assignments = append(assignments, fmt.Sprintf("delivered_at = $%d", next))
			args = append(args, time.Now().UTC())
			next++
		}
	}
	if req.Notes != nil {
		assignments = append(assignments, fmt.Sprintf("notes = $%d", next))
		args = append(args, strings.TrimSpace(*req.Notes))
		next++
	}

	assignments = append(assignments, fmt.Sprintf("updated_at = $%d", next))
	args = append(args, time.Now().UTC())

	q := fmt.Sprintf(`UPDATE ecommerce_fulfillments SET %s WHERE tenant_id = $1 AND id = $2`, strings.Join(assignments, ", "))
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return fulfillment{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fulfillment{}, err
	}
	if affected == 0 {
		return fulfillment{}, sql.ErrNoRows
	}
	s.invalidateTenantCache(tenantID)
	return s.getByID(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// CRUD - Delete
// ---------------------------------------------------------------------------

func (s *service) deleteFulfillment(ctx context.Context, tenantID, id string) error {
	if s.db == nil {
		s.memMu.Lock()
		ff, ok := s.memByID[id]
		if !ok || ff.TenantID != tenantID {
			s.memMu.Unlock()
			return sql.ErrNoRows
		}
		delete(s.memByID, id)
		s.memMu.Unlock()
		s.invalidateTenantCache(tenantID)
		return nil
	}

	res, err := s.db.ExecContext(ctx, `DELETE FROM ecommerce_fulfillments WHERE tenant_id=$1 AND id=$2`, tenantID, id)
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

func (s *service) explainList(ctx context.Context, tenantID, orderID, status, carrier string) (any, error) {
	if s.db == nil {
		return map[string]any{"mode": "memory", "note": "no SQL plan available"}, nil
	}

	args := []any{tenantID}
	where := []string{"tenant_id = $1"}
	nextArg := 2
	if orderID != "" {
		where = append(where, fmt.Sprintf("order_id = $%d", nextArg))
		args = append(args, orderID)
		nextArg++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", nextArg))
		args = append(args, normalizeStatus(status))
		nextArg++
	}
	if carrier != "" {
		where = append(where, fmt.Sprintf("carrier = $%d", nextArg))
		args = append(args, carrier)
		nextArg++
	}
	planQuery := fmt.Sprintf(`EXPLAIN (ANALYZE FALSE, FORMAT JSON)
		SELECT id, tenant_id, order_id, warehouse_id, tracking_number, carrier, service_type, items_json, status, shipped_at, delivered_at, notes, created_at, updated_at
		FROM ecommerce_fulfillments
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

func (s *service) getListCache(tenantID, orderID, status, carrier, cursor string, limit int) (listResponse, bool) {
	key := cacheKey(tenantID, orderID, status, carrier, cursor, limit)
	s.cacheMu.RLock()
	item, ok := s.listCache[key]
	s.cacheMu.RUnlock()
	if !ok || time.Now().After(item.Expires) {
		return listResponse{}, false
	}
	return item.Response, true
}

func (s *service) setListCache(tenantID, orderID, status, carrier, cursor string, limit int, value listResponse) {
	key := cacheKey(tenantID, orderID, status, carrier, cursor, limit)
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

func cacheKey(tenantID, orderID, status, carrier, cursor string, limit int) string {
	return fmt.Sprintf("%s|%s|%s|%s|%s|%d", tenantID, orderID, normalizeStatus(status), carrier, cursor, limit)
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
		return fmt.Sprintf("ff_%d", time.Now().UnixNano())
	}
	return "ff_" + hex.EncodeToString(buf)
}
