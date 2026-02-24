package main

import (
	"testing"
	"time"
)

func TestCursorRoundTrip(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Microsecond)
	id := "sub_abc123"

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
		memByID:   make(map[string]subscription),
	}

	tenantID := "tenant-a"
	created := time.Now().UTC()
	sub := subscription{
		ID:         "sub1",
		TenantID:   tenantID,
		CustomerID: "cust-1",
		PlanID:     "plan-premium",
		PlanName:   "Premium",
		Interval:   "monthly",
		Price:      "29.99",
		Currency:   "USD",
		Status:     "active",
		CreatedAt:  created,
		UpdatedAt:  created,
	}

	if err := svc.createSubscription(nil, sub); err != nil {
		t.Fatalf("createSubscription returned error: %v", err)
	}

	first, err := svc.listSubscriptions(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("first listSubscriptions returned error: %v", err)
	}
	if len(first.Items) != 1 {
		t.Fatalf("expected 1 item on first list, got %d", len(first.Items))
	}
	if first.Cached {
		t.Fatal("first list should not be cached")
	}

	second, err := svc.listSubscriptions(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("second listSubscriptions returned error: %v", err)
	}
	if !second.Cached {
		t.Fatal("expected second list to hit cache")
	}

	if err := svc.deleteSubscription(nil, tenantID, sub.ID); err != nil {
		t.Fatalf("deleteSubscription returned error: %v", err)
	}

	third, err := svc.listSubscriptions(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("third listSubscriptions returned error: %v", err)
	}
	if third.Cached {
		t.Fatal("expected cache invalidation after delete")
	}
	if len(third.Items) != 0 {
		t.Fatalf("expected empty list after delete, got %d", len(third.Items))
	}
}
