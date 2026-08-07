package main

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

// AuditEntry is one line in the activity feed: who did what, and when.
type AuditEntry struct {
	ID        string    `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	User      string    `json:"user"`
	Action    string    `json:"action"`  // machine tag, e.g. "trunk.created"
	Message   string    `json:"message"` // human-readable, e.g. `added new trunk "Airtel-Lab-01"`
}

const auditFile = "audit.json"
const auditMaxEntries = 2000

type AuditLog struct {
	mu      sync.Mutex
	entries []AuditEntry
}

func NewAuditLog() *AuditLog {
	al := &AuditLog{}
	al.load()
	return al
}

func (al *AuditLog) load() {
	raw, err := os.ReadFile(auditFile)
	if err != nil {
		return
	}
	var entries []AuditEntry
	if err := json.Unmarshal(raw, &entries); err == nil {
		al.entries = entries
	}
}

func (al *AuditLog) persistLocked() {
	raw, err := json.MarshalIndent(al.entries, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(auditFile, raw, 0644)
}

func (al *AuditLog) Log(user, action, message string) {
	al.mu.Lock()
	defer al.mu.Unlock()
	al.entries = append(al.entries, AuditEntry{
		ID:        newID("evt"),
		Timestamp: time.Now().UTC(),
		User:      user,
		Action:    action,
		Message:   message,
	})
	if len(al.entries) > auditMaxEntries {
		al.entries = al.entries[len(al.entries)-auditMaxEntries:]
	}
	al.persistLocked()
}

// Recent returns up to `limit` entries, newest first. limit <= 0 means all.
func (al *AuditLog) Recent(limit int) []AuditEntry {
	al.mu.Lock()
	defer al.mu.Unlock()
	n := len(al.entries)
	if limit <= 0 || limit > n {
		limit = n
	}
	out := make([]AuditEntry, limit)
	for i := 0; i < limit; i++ {
		out[i] = al.entries[n-1-i]
	}
	return out
}

func (al *AuditLog) All() []AuditEntry {
	al.mu.Lock()
	defer al.mu.Unlock()
	out := make([]AuditEntry, len(al.entries))
	copy(out, al.entries)
	return out
}

func (al *AuditLog) ReplaceAll(entries []AuditEntry) {
	al.mu.Lock()
	defer al.mu.Unlock()
	al.entries = entries
	al.persistLocked()
}
