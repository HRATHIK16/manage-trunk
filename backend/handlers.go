package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

type API struct {
	store *Store
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// validateTrunkInput does basic sanity checks on a trunk payload.
func validateTrunkInput(t SipTrunk) string {
	if strings.TrimSpace(t.Name) == "" {
		return "name is required"
	}
	if strings.TrimSpace(t.PilotNumber) == "" {
		return "pilot number is required"
	}
	if t.DIDStart <= 0 || t.DIDEnd <= 0 {
		return "did range must be positive numbers"
	}
	if t.DIDStart > t.DIDEnd {
		return "did range start must be <= end"
	}
	if t.TotalChannels <= 0 {
		return "total channels must be greater than 0"
	}
	if t.CPS <= 0 {
		return "cps must be greater than 0"
	}
	return ""
}

func validateAssignmentInput(a Assignment) string {
	if strings.TrimSpace(a.TenantName) == "" {
		return "tenant name is required"
	}
	if a.ChannelsAssigned <= 0 {
		return "channels assigned must be greater than 0"
	}
	if a.DIDStart <= 0 || a.DIDEnd <= 0 {
		return "did range must be positive numbers"
	}
	return ""
}

// ---- /api/trunks ----

func (api *API) trunksHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, api.store.ListTrunks())
	case http.MethodPost:
		var t SipTrunk
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid json body")
			return
		}
		if msg := validateTrunkInput(t); msg != "" {
			writeErr(w, http.StatusBadRequest, msg)
			return
		}
		created := api.store.CreateTrunk(t)
		writeJSON(w, http.StatusCreated, created)
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// ---- /api/trunks/{id} ----

func (api *API) trunkByIDHandler(w http.ResponseWriter, r *http.Request, id string) {
	switch r.Method {
	case http.MethodGet:
		t, ok := api.store.GetTrunk(id)
		if !ok {
			writeErr(w, http.StatusNotFound, "trunk not found")
			return
		}
		writeJSON(w, http.StatusOK, t)
	case http.MethodDelete:
		if !api.store.DeleteTrunk(id) {
			writeErr(w, http.StatusNotFound, "trunk not found")
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// ---- /api/trunks/{id}/summary ----

func (api *API) trunkSummaryHandler(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	sum, err := api.store.Summary(id)
	if err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, sum)
}

// ---- /api/trunks/{id}/assignments ----

func (api *API) trunkAssignmentsHandler(w http.ResponseWriter, r *http.Request, trunkID string) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, api.store.ListAssignmentsForTrunk(trunkID))
	case http.MethodPost:
		var a Assignment
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid json body")
			return
		}
		a.TrunkID = trunkID
		if msg := validateAssignmentInput(a); msg != "" {
			writeErr(w, http.StatusBadRequest, msg)
			return
		}
		created, err := api.store.CreateAssignment(a)
		if err != nil {
			writeErr(w, http.StatusConflict, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, created)
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// ---- /api/assignments/{id} ----

func (api *API) assignmentByIDHandler(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodDelete {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !api.store.DeleteAssignment(id) {
		writeErr(w, http.StatusNotFound, "assignment not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}
