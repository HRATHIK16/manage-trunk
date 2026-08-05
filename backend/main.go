package main

import (
	"log"
	"net/http"
	"strings"
)

func withCORS(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h(w, r)
	}
}

func main() {
	store := NewStore()
	api := &API{store: store}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/trunks", withCORS(api.trunksHandler))

	// /api/trunks/{id} and /api/trunks/{id}/summary and /api/trunks/{id}/assignments
	mux.HandleFunc("/api/trunks/", withCORS(func(w http.ResponseWriter, r *http.Request) {
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
	}))

	mux.HandleFunc("/api/assignments/", withCORS(func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/api/assignments/")
		id = strings.Trim(id, "/")
		if id == "" {
			http.NotFound(w, r)
			return
		}
		api.assignmentByIDHandler(w, r, id)
	}))

	mux.HandleFunc("/api/health", withCORS(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}))

	addr := ":8080"
	log.Printf("sip-trunk-manager backend listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
