package main

import (
	"testing"
	"time"
)

func TestCursorRoundTrip(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Microsecond)
	id := "aev_abc123"

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
		memByID:   make(map[string]analyticsEvent),
	}

	tenantID := "tenant-a"
	created := time.Now().UTC()
	evt := analyticsEvent{
		ID:        "aev1",
		TenantID:  tenantID,
		EventType: "page_view",
		SessionID: "sess-1",
		UserID:    "user-1",
		PageURL:   "https://example.com",
		CreatedAt: created,
	}

	if err := svc.createEvent(nil, evt); err != nil {
		t.Fatalf("createEvent returned error: %v", err)
	}

	first, err := svc.listEvents(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("first listEvents returned error: %v", err)
	}
	if len(first.Items) != 1 {
		t.Fatalf("expected 1 item on first list, got %d", len(first.Items))
	}
	if first.Cached {
		t.Fatal("first list should not be cached")
	}

	second, err := svc.listEvents(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("second listEvents returned error: %v", err)
	}
	if !second.Cached {
		t.Fatal("expected second list to hit cache")
	}

	// Create another event to invalidate cache
	evt2 := analyticsEvent{
		ID:        "aev2",
		TenantID:  tenantID,
		EventType: "click",
		SessionID: "sess-2",
		CreatedAt: created.Add(time.Second),
	}
	if err := svc.createEvent(nil, evt2); err != nil {
		t.Fatalf("createEvent returned error: %v", err)
	}

	third, err := svc.listEvents(nil, tenantID, "", "", "", "", 10)
	if err != nil {
		t.Fatalf("third listEvents returned error: %v", err)
	}
	if third.Cached {
		t.Fatal("expected cache invalidation after create")
	}
	if len(third.Items) != 2 {
		t.Fatalf("expected 2 items after second create, got %d", len(third.Items))
	}
}
