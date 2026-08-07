package main

import (
	"log"
	"net/http"
	"strings"
)

func withCORS(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h(w, r)
	}
}

func main() {
	store := NewStore()
	auth := NewAuth()
	audit := NewAuditLog()
	api := &API{store: store, auth: auth, audit: audit}

	mux := http.NewServeMux()

	// Public
	mux.HandleFunc("/api/login", withCORS(api.loginHandler))
	mux.HandleFunc("/api/health", withCORS(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}))

	// Protected
	mux.HandleFunc("/api/logout", withCORS(auth.requireAuth(api.logoutHandler)))
	mux.HandleFunc("/api/trunks", withCORS(auth.requireAuth(api.trunksHandler)))
	mux.HandleFunc("/api/audit", withCORS(auth.requireAuth(api.auditHandler)))
	mux.HandleFunc("/api/backup", withCORS(auth.requireAuth(api.backupHandler)))
	mux.HandleFunc("/api/restore", withCORS(auth.requireAuth(api.restoreHandler)))

	// /api/trunks/{id}, /api/trunks/{id}/summary, /api/trunks/{id}/assignments
	mux.HandleFunc("/api/trunks/", withCORS(auth.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/trunks/")
		parts := strings.Split(strings.Trim(path, "/"), "/")

		id := parts[0]
		if id == "" {
			http.NotFound(w, r)
			return
		}

		switch {
		case len(parts) == 1:
			api.trunkByIDHandler(w, r, id)
		case len(parts) == 2 && parts[1] == "summary":
			api.trunkSummaryHandler(w, r, id)
		case len(parts) == 2 && parts[1] == "assignments":
			api.trunkAssignmentsHandler(w, r, id)
		default:
			http.NotFound(w, r)
		}
	})))

	mux.HandleFunc("/api/assignments/", withCORS(auth.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/api/assignments/")
		id = strings.Trim(id, "/")
		if id == "" {
			http.NotFound(w, r)
			return
		}
		api.assignmentByIDHandler(w, r, id)
	})))

	addr := ":8080"
	log.Printf("sip-trunk-manager backend listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
