package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type API struct {
	store *Store
	auth  *Auth
	audit *AuditLog
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func normalizeEnv(env string) string {
	env = strings.ToLower(strings.TrimSpace(env))
	if env == "" {
		return "prod"
	}
	return env
}

// validateTrunkInput does basic sanity checks on a trunk payload. Call
// normalizeEnv on t.Environment before validating.
func validateTrunkInput(t SipTrunk) string {
	if strings.TrimSpace(t.Name) == "" {
		return "name is required"
	}
	if t.Environment != "prod" && t.Environment != "lab" {
		return "environment must be prod or lab"
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

// ---- Auth ----

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (api *API) loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json body")
		return
	}
	token, ok := api.auth.Login(strings.TrimSpace(req.Username), req.Password)
	if !ok {
		writeErr(w, http.StatusUnauthorized, "incorrect username or password")
		return
	}
	api.audit.Log(req.Username, "auth.login", "logged in")
	writeJSON(w, http.StatusOK, map[string]string{"token": token, "username": req.Username})
}

func (api *API) logoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	authz := r.Header.Get("Authorization")
	token := strings.TrimPrefix(authz, "Bearer ")
	api.auth.Logout(token)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
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
		t.Environment = normalizeEnv(t.Environment)
		if msg := validateTrunkInput(t); msg != "" {
			writeErr(w, http.StatusBadRequest, msg)
			return
		}
		created := api.store.CreateTrunk(t)
		api.audit.Log(userFromContext(r), "trunk.created",
			fmt.Sprintf("added new trunk %q (%s, %d channels, CPS %d)", created.Name, created.Environment, created.TotalChannels, created.CPS))
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

	case http.MethodPut:
		var t SipTrunk
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid json body")
			return
		}
		t.Environment = normalizeEnv(t.Environment)
		if msg := validateTrunkInput(t); msg != "" {
			writeErr(w, http.StatusBadRequest, msg)
			return
		}
		updated, err := api.store.UpdateTrunk(id, t)
		if err != nil {
			writeErr(w, http.StatusConflict, err.Error())
			return
		}
		api.audit.Log(userFromContext(r), "trunk.updated", fmt.Sprintf("updated trunk %q", updated.Name))
		writeJSON(w, http.StatusOK, updated)

	case http.MethodDelete:
		t, ok := api.store.GetTrunk(id)
		if !ok {
			writeErr(w, http.StatusNotFound, "trunk not found")
			return
		}
		api.store.DeleteTrunk(id)
		api.audit.Log(userFromContext(r), "trunk.deleted", fmt.Sprintf("deleted trunk %q", t.Name))
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
		trunkName := trunkID
		if t, ok := api.store.GetTrunk(trunkID); ok {
			trunkName = t.Name
		}
		api.audit.Log(userFromContext(r), "assignment.created",
			fmt.Sprintf("assigned %d channel(s) and DIDs %d\u2013%d to %q on trunk %q",
				created.ChannelsAssigned, created.DIDStart, created.DIDEnd, created.TenantName, trunkName))
		writeJSON(w, http.StatusCreated, created)
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// ---- /api/assignments/{id} ----

func (api *API) assignmentByIDHandler(w http.ResponseWriter, r *http.Request, id string) {
	switch r.Method {
	case http.MethodPut:
		var a Assignment
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid json body")
			return
		}
		if msg := validateAssignmentInput(a); msg != "" {
			writeErr(w, http.StatusBadRequest, msg)
			return
		}
		updated, err := api.store.UpdateAssignment(id, a)
		if err != nil {
			writeErr(w, http.StatusConflict, err.Error())
			return
		}
		trunkName := updated.TrunkID
		if t, ok := api.store.GetTrunk(updated.TrunkID); ok {
			trunkName = t.Name
		}
		api.audit.Log(userFromContext(r), "assignment.updated",
			fmt.Sprintf("updated %q's assignment on trunk %q (%d channel(s), DIDs %d\u2013%d)",
				updated.TenantName, trunkName, updated.ChannelsAssigned, updated.DIDStart, updated.DIDEnd))
		writeJSON(w, http.StatusOK, updated)

	case http.MethodDelete:
		a, ok := api.store.GetAssignment(id)
		if !ok {
			writeErr(w, http.StatusNotFound, "assignment not found")
			return
		}
		api.store.DeleteAssignment(id)
		trunkName := a.TrunkID
		if t, ok := api.store.GetTrunk(a.TrunkID); ok {
			trunkName = t.Name
		}
		api.audit.Log(userFromContext(r), "assignment.deleted",
			fmt.Sprintf("removed %q's assignment (%d channel(s)) from trunk %q", a.TenantName, a.ChannelsAssigned, trunkName))
		writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})

	default:
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// ---- /api/audit ----

func (api *API) auditHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	writeJSON(w, http.StatusOK, api.audit.Recent(limit))
}

// ---- /api/backup & /api/restore ----

type backupPayload struct {
	ExportedAt  time.Time              `json:"exportedAt"`
	Trunks      map[string]SipTrunk    `json:"trunks"`
	Assignments map[string]Assignment  `json:"assignments"`
	Audit       []AuditEntry           `json:"audit"`
}

func (api *API) backupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	trunks, assignments := api.store.ExportAll()
	payload := backupPayload{
		ExportedAt:  time.Now().UTC(),
		Trunks:      trunks,
		Assignments: assignments,
		Audit:       api.audit.All(),
	}
	filename := fmt.Sprintf("trunkline-backup-%s.json", time.Now().UTC().Format("2006-01-02"))
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	_ = json.NewEncoder(w).Encode(payload)
}

func (api *API) restoreHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var payload backupPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid backup file: "+err.Error())
		return
	}
	api.store.ImportAll(payload.Trunks, payload.Assignments)
	if len(payload.Audit) > 0 {
		api.audit.ReplaceAll(payload.Audit)
	}
	api.audit.Log(userFromContext(r), "backup.restored",
		fmt.Sprintf("restored data from a backup file (%d trunk(s), %d assignment(s))", len(payload.Trunks), len(payload.Assignments)))
	writeJSON(w, http.StatusOK, map[string]any{
		"restored":    true,
		"trunks":      len(payload.Trunks),
		"assignments": len(payload.Assignments),
	})
}
