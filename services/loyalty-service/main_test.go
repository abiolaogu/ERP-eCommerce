package main

import (
	"testing"
	"time"
)

func TestCursorRoundTrip(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Microsecond)
	id := "la_abc123"

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
		memByID:   make(map[string]loyaltyAccount),
	}

	tenantID := "tenant-a"
	created := time.Now().UTC()
	acct := loyaltyAccount{
		ID:            "la1",
		TenantID:      tenantID,
		CustomerID:    "cust-1",
		Tier:          "silver",
		PointsBalance: 500,
		Status:        "active",
		CreatedAt:     created,
		UpdatedAt:     created,
	}

	if err := svc.createAccount(nil, acct); err != nil {
		t.Fatalf("createAccount returned error: %v", err)
	}

	first, err := svc.listAccounts(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("first listAccounts returned error: %v", err)
	}
	if len(first.Items) != 1 {
		t.Fatalf("expected 1 item on first list, got %d", len(first.Items))
	}
	if first.Cached {
		t.Fatal("first list should not be cached")
	}

	second, err := svc.listAccounts(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("second listAccounts returned error: %v", err)
	}
	if !second.Cached {
		t.Fatal("expected second list to hit cache")
	}

	if err := svc.deleteAccount(nil, tenantID, acct.ID); err != nil {
		t.Fatalf("deleteAccount returned error: %v", err)
	}

	third, err := svc.listAccounts(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("third listAccounts returned error: %v", err)
	}
	if third.Cached {
		t.Fatal("expected cache invalidation after delete")
	}
	if len(third.Items) != 0 {
		t.Fatalf("expected empty list after delete, got %d", len(third.Items))
	}
}
