package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
)

type payload map[string]any

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	module := os.Getenv("MODULE_NAME")
	if module == "" {
		module = "ERP-eCommerce"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "module": module, "service": "storefront-service"})
	})

	base := "/v1/storefront"

	mux.HandleFunc(base, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Tenant-ID") == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing X-Tenant-ID"})
			return
		}
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, http.StatusOK, map[string]any{"items": []map[string]any{}, "event_topic": "erp.ecommerce.storefront.listed"})
		case http.MethodPost:
			var body payload
			_ = json.NewDecoder(r.Body).Decode(&body)
			writeJSON(w, http.StatusCreated, map[string]any{"item": body, "event_topic": "erp.ecommerce.storefront.created"})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
	})

	mux.HandleFunc(base+"/", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Tenant-ID") == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing X-Tenant-ID"})
			return
		}
		id := strings.TrimPrefix(r.URL.Path, base+"/")
		if id == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing id"})
			return
		}
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "event_topic": "erp.ecommerce.storefront.read"})
		case http.MethodPut, http.MethodPatch:
			var body payload
			_ = json.NewDecoder(r.Body).Decode(&body)
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "item": body, "event_topic": "erp.ecommerce.storefront.updated"})
		case http.MethodDelete:
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "event_topic": "erp.ecommerce.storefront.deleted"})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
	})

	log.Printf("%s listening on :%s", "storefront-service", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
