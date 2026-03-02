package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
)

type capabilityDoc struct {
	Module          string   `json:"module"`
	Version         string   `json:"version,omitempty"`
	Capabilities    []string `json:"capabilities"`
	IntegrationMode string   `json:"integration_mode,omitempty"`
	AIDDGovernance  string   `json:"aidd_governance,omitempty"`
}

var reqCounter uint64

func loadCapabilities() capabilityDoc {
	b, err := os.ReadFile("configs/capabilities.json")
	if err != nil {
		return capabilityDoc{Module: "ERP-eCommerce", Capabilities: []string{"unconfigured"}}
	}
	var d capabilityDoc
	if err := json.Unmarshal(b, &d); err != nil {
		return capabilityDoc{Module: "ERP-eCommerce", Capabilities: []string{"invalid_config"}}
	}
	if d.Module == "" {
		d.Module = "ERP-eCommerce"
	}
	return d
}

func writeJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func nextRequestID(r *http.Request) string {
	if id := r.Header.Get("X-Request-ID"); id != "" {
		return id
	}
	n := atomic.AddUint64(&reqCounter, 1)
	return fmt.Sprintf("req-%d-%d", time.Now().UnixNano(), n)
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	s.status = status
	s.ResponseWriter.WriteHeader(status)
}

// envOrDefault returns the value of the environment variable named by key,
// or the provided fallback if the variable is unset or empty.
func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// corsOrigins returns the set of allowed CORS origins read from the
// CORS_ORIGINS environment variable (comma-separated). If the variable
// is not set, it defaults to allowing all origins ("*").
func corsOrigins() []string {
	raw := os.Getenv("CORS_ORIGINS")
	if raw == "" {
		return []string{"*"}
	}
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			origins = append(origins, p)
		}
	}
	if len(origins) == 0 {
		return []string{"*"}
	}
	return origins
}

// withCORS wraps a handler with CORS header handling. Allowed origins are
// read once at startup from the CORS_ORIGINS env var.
func withCORS(origins []string, next http.Handler) http.Handler {
	allowAll := len(origins) == 1 && origins[0] == "*"
	originSet := make(map[string]struct{}, len(origins))
	for _, o := range origins {
		originSet[o] = struct{}{}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if allowAll {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin != "" {
			if _, ok := originSet[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID, X-Tenant-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// withJWT validates the Authorization header carries a Bearer token on
// protected routes (anything under /v1/ except /v1/capabilities). When
// JWT_SECRET is not configured the middleware is a pass-through, which
// keeps local development frictionless.
func withJWT(next http.Handler) http.Handler {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Println("WARN: JWT_SECRET not set — JWT validation disabled")
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/v1/") || r.URL.Path == "/v1/capabilities" {
			next.ServeHTTP(w, r)
			return
		}

		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing or invalid Authorization header"})
			return
		}

		// NOTE: full signature verification should be performed here using
		// the JWT_SECRET. For now we validate the header format and forward
		// the token to backend services which perform full verification.

		next.ServeHTTP(w, r)
	})
}

// withTenantIsolation ensures every /v1/ request carries an X-Tenant-ID
// header. Requests without a tenant identifier are rejected with 400.
func withTenantIsolation(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/v1/") && r.URL.Path != "/v1/capabilities" {
			if r.Header.Get("X-Tenant-ID") == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "X-Tenant-ID header is required"})
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func withServerDefaults(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		requestID := nextRequestID(r)

		w.Header().Set("X-Request-ID", requestID)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Cache-Control", "no-store")

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		tenant := r.Header.Get("X-Tenant-ID")
		if tenant == "" {
			tenant = "system"
		}
		log.Printf("method=%s path=%s status=%d duration_ms=%d tenant=%s request_id=%s remote=%s",
			r.Method,
			r.URL.Path,
			rec.status,
			time.Since(start).Milliseconds(),
			tenant,
			requestID,
			r.RemoteAddr,
		)
	})
}

// proxyRoute registers a reverse proxy for the given path prefix. Requests
// to both "/prefix" and "/prefix/..." are forwarded to the backend URL.
func proxyRoute(mux *http.ServeMux, pathPrefix, backendURL string) {
	target, err := url.Parse(backendURL)
	if err != nil {
		log.Fatalf("invalid backend URL %q for prefix %s: %v", backendURL, pathPrefix, err)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("proxy error prefix=%s target=%s err=%v", pathPrefix, backendURL, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error":  "bad_gateway",
			"detail": fmt.Sprintf("upstream %s unreachable", pathPrefix),
		})
	}

	mux.HandleFunc(pathPrefix+"/", func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})
	mux.HandleFunc(pathPrefix, func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})

	log.Printf("route %s -> %s", pathPrefix, backendURL)
}

func main() {
	doc := loadCapabilities()
	origins := corsOrigins()
	mux := http.NewServeMux()

	// --- Health & capabilities (gateway-level) ---

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "module": doc.Module})
	})

	mux.HandleFunc("/v1/capabilities", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		writeJSON(w, http.StatusOK, doc)
	})

	// --- Reverse-proxy routes to backend microservices ---

	proxyRoute(mux, "/v1/storefront", envOrDefault("STOREFRONT_SERVICE_URL", "http://storefront-service:8701"))
	proxyRoute(mux, "/v1/checkout", envOrDefault("CHECKOUT_SERVICE_URL", "http://checkout-service:8702"))
	proxyRoute(mux, "/v1/fulfillment", envOrDefault("FULFILLMENT_SERVICE_URL", "http://fulfillment-service:8703"))
	proxyRoute(mux, "/v1/search", envOrDefault("SEARCH_SERVICE_URL", "http://search-service:8704"))
	proxyRoute(mux, "/v1/loyalty", envOrDefault("LOYALTY_SERVICE_URL", "http://loyalty-service:8705"))
	proxyRoute(mux, "/v1/analytics", envOrDefault("ANALYTICS_SERVICE_URL", "http://analytics-service:8706"))
	proxyRoute(mux, "/v1/subscriptions", envOrDefault("SUBSCRIPTION_COMMERCE_SERVICE_URL", "http://subscription-commerce-service:8707"))
	proxyRoute(mux, "/v1/social", envOrDefault("SOCIAL_COMMERCE_SERVICE_URL", "http://social-commerce-service:8708"))
	proxyRoute(mux, "/v1/themes", envOrDefault("THEME_SERVICE_URL", "http://theme-service:8709"))

	// --- Server ---

	port := envOrDefault("PORT", "8090")
	addr := ":" + port

	handler := withCORS(origins, withServerDefaults(withJWT(withTenantIsolation(mux))))

	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 2 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	// --- Graceful shutdown ---

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("%s gateway listening on %s (CORS origins: %v)", doc.Module, addr, origins)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	<-done
	log.Printf("%s gateway shutting down gracefully...", doc.Module)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("forced shutdown: %v", err)
	}
	log.Printf("%s gateway stopped", doc.Module)
}
