package main

import (
	"testing"
	"time"
)

func TestCursorRoundTrip(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Microsecond)
	id := "co_abc123"

	cursor := encodeCursor(now, id)
	decodedTime, decodedID, err := parseCursor(cursor)
	if err != nil {
		t.Fatalf("parseCursor returned error: %v", err)
	}
	if !decodedTime.Equal(now) {
		t.Fatalf("decoded time mismatch: got %s want %s", decodedTime, now)
	}
	if decodedID != id {
		t.Fatalf("decoded id mismatch: got %s want %s", decodedID, id)
	}
}

func TestMemoryListInvalidatesCache(t *testing.T) {
	svc := &service{
		cacheTTL:  time.Minute,
		listCache: make(map[string]cacheItem),
		memByID:   make(map[string]checkout),
	}

	tenantID := "tenant-a"
	created := time.Now().UTC()
	co := checkout{
		ID:         "co1",
		TenantID:   tenantID,
		CartID:     "cart-1",
		CustomerID: "cust-1",
		Status:     "initiated",
		Currency:   "USD",
		CreatedAt:  created,
		UpdatedAt:  created,
	}

	if err := svc.createCheckout(nil, co); err != nil {
		t.Fatalf("createCheckout returned error: %v", err)
	}

	first, err := svc.listCheckouts(nil, tenantID, "", "", "", 10)
	if err != nil {
		t.Fatalf("first listCheckouts returned error: %v", err)
	}
	if len(first.Items) != 1 {
		t.Fatalf("expected 1 item on first list, got %d", len(first.Items))
	}
	if first.Cached {
		t.Fatal("first list should not be cached")
	}

	second, err := svc.listCheckouts(nil, tenantID, "", "", "", 10)
	if err != nil {
		t.Fatalf("second listCheckouts returned error: %v", err)
	}
	if !second.Cached {
		t.Fatal("expected second list to hit cache")
	}

	if err := svc.deleteCheckout(nil, tenantID, co.ID); err != nil {
		t.Fatalf("deleteCheckout returned error: %v", err)
	}

	third, err := svc.listCheckouts(nil, tenantID, "", "", "", 10)
	if err != nil {
		t.Fatalf("third listCheckouts returned error: %v", err)
	}
	if third.Cached {
		t.Fatal("expected cache invalidation after delete")
	}
	if len(third.Items) != 0 {
		t.Fatalf("expected empty list after delete, got %d", len(third.Items))
	}
}
