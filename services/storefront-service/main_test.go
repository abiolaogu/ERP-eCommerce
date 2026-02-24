package main

import (
	"testing"
	"time"
)

func TestCursorRoundTrip(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Microsecond)
	id := "sf_abc123"

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
		memByID:   make(map[string]storefront),
	}

	tenantID := "tenant-a"
	created := time.Now().UTC()
	sf := storefront{
		ID:       "sf1",
		TenantID: tenantID,
		Name:     "My Store",
		Slug:     "my-store",
		Currency: "USD",
		Locale:   "en",
		Status:   "active",
		CreatedAt: created,
		UpdatedAt: created,
	}

	if err := svc.createStorefront(nil, sf); err != nil {
		t.Fatalf("createStorefront returned error: %v", err)
	}

	first, err := svc.listStorefronts(nil, tenantID, "", "", 10)
	if err != nil {
		t.Fatalf("first listStorefronts returned error: %v", err)
	}
	if len(first.Items) != 1 {
		t.Fatalf("expected 1 item on first list, got %d", len(first.Items))
	}
	if first.Cached {
		t.Fatal("first list should not be cached")
	}

	second, err := svc.listStorefronts(nil, tenantID, "", "", 10)
	if err != nil {
		t.Fatalf("second listStorefronts returned error: %v", err)
	}
	if !second.Cached {
		t.Fatal("expected second list to hit cache")
	}

	if err := svc.deleteStorefront(nil, tenantID, sf.ID); err != nil {
		t.Fatalf("deleteStorefront returned error: %v", err)
	}

	third, err := svc.listStorefronts(nil, tenantID, "", "", 10)
	if err != nil {
		t.Fatalf("third listStorefronts returned error: %v", err)
	}
	if third.Cached {
		t.Fatal("expected cache invalidation after delete")
	}
	if len(third.Items) != 0 {
		t.Fatalf("expected empty list after delete, got %d", len(third.Items))
	}
}
