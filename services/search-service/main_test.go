package main

import (
	"testing"
	"time"
)

func TestCursorRoundTrip(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Microsecond)
	id := "si_abc123"

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
		memByID:   make(map[string]searchIndex),
	}

	tenantID := "tenant-a"
	created := time.Now().UTC()
	idx := searchIndex{
		ID:            "si1",
		TenantID:      tenantID,
		IndexName:     "products",
		EntityType:    "product",
		DocumentCount: 100,
		Status:        "active",
		CreatedAt:     created,
		UpdatedAt:     created,
	}

	if err := svc.createIndex(nil, idx); err != nil {
		t.Fatalf("createIndex returned error: %v", err)
	}

	first, err := svc.listIndexes(nil, tenantID, "", "", "", 10)
	if err != nil {
		t.Fatalf("first listIndexes returned error: %v", err)
	}
	if len(first.Items) != 1 {
		t.Fatalf("expected 1 item on first list, got %d", len(first.Items))
	}
	if first.Cached {
		t.Fatal("first list should not be cached")
	}

	second, err := svc.listIndexes(nil, tenantID, "", "", "", 10)
	if err != nil {
		t.Fatalf("second listIndexes returned error: %v", err)
	}
	if !second.Cached {
		t.Fatal("expected second list to hit cache")
	}

	if err := svc.deleteIndex(nil, tenantID, idx.ID); err != nil {
		t.Fatalf("deleteIndex returned error: %v", err)
	}

	third, err := svc.listIndexes(nil, tenantID, "", "", "", 10)
	if err != nil {
		t.Fatalf("third listIndexes returned error: %v", err)
	}
	if third.Cached {
		t.Fatal("expected cache invalidation after delete")
	}
	if len(third.Items) != 0 {
		t.Fatalf("expected empty list after delete, got %d", len(third.Items))
	}
}
