package main

import (
	"testing"
	"time"
)

func TestCursorRoundTrip(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Microsecond)
	id := "thm_abc123"

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
		memByID:   make(map[string]theme),
	}

	tenantID := "tenant-a"
	created := time.Now().UTC()
	th := theme{
		ID:        "thm1",
		TenantID:  tenantID,
		Name:      "Modern Light",
		Author:    "ERP Team",
		Version:   "1.0.0",
		Category:  "minimal",
		Status:    "active",
		CreatedAt: created,
		UpdatedAt: created,
	}

	if err := svc.createTheme(nil, th); err != nil {
		t.Fatalf("createTheme returned error: %v", err)
	}

	first, err := svc.listThemes(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("first listThemes returned error: %v", err)
	}
	if len(first.Items) != 1 {
		t.Fatalf("expected 1 item on first list, got %d", len(first.Items))
	}
	if first.Cached {
		t.Fatal("first list should not be cached")
	}

	second, err := svc.listThemes(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("second listThemes returned error: %v", err)
	}
	if !second.Cached {
		t.Fatal("expected second list to hit cache")
	}

	if err := svc.deleteTheme(nil, tenantID, th.ID); err != nil {
		t.Fatalf("deleteTheme returned error: %v", err)
	}

	third, err := svc.listThemes(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("third listThemes returned error: %v", err)
	}
	if third.Cached {
		t.Fatal("expected cache invalidation after delete")
	}
	if len(third.Items) != 0 {
		t.Fatalf("expected empty list after delete, got %d", len(third.Items))
	}
}
