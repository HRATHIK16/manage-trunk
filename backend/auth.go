package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ConfigUser is one entry in config/users.json. Passwords are plain text in
// this file on purpose, matching how the team wanted to bootstrap this: a
// small, editable roster for a handful of trusted operators. If this ever
// grows beyond a small internal team, swap this for hashed passwords or a
// real identity provider.
type ConfigUser struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type session struct {
	Username  string
	ExpiresAt time.Time
}

const usersConfigPath = "config/users.json"
const sessionTTL = 12 * time.Hour

type Auth struct {
	mu       sync.RWMutex
	users    []ConfigUser
	sessions map[string]session
}

func NewAuth() *Auth {
	a := &Auth{sessions: map[string]session{}}
	a.loadUsers()
	return a
}

func (a *Auth) loadUsers() {
	raw, err := os.ReadFile(usersConfigPath)
	if err != nil {
		// No config found — fall back to a default so the app is never
		// locked out, but operators should edit config/users.json right away.
		a.users = []ConfigUser{{Username: "admin", Password: "changeme"}}
		return
	}
	var users []ConfigUser
	if err := json.Unmarshal(raw, &users); err != nil || len(users) == 0 {
		a.users = []ConfigUser{{Username: "admin", Password: "changeme"}}
		return
	}
	a.users = users
}

func (a *Auth) Login(username, password string) (string, bool) {
	a.mu.RLock()
	ok := false
	for _, u := range a.users {
		if u.Username == username && u.Password == password {
			ok = true
			break
		}
	}
	a.mu.RUnlock()
	if !ok {
		return "", false
	}

	token := newToken()
	a.mu.Lock()
	a.sessions[token] = session{Username: username, ExpiresAt: time.Now().Add(sessionTTL)}
	a.mu.Unlock()
	return token, true
}

func (a *Auth) Logout(token string) {
	a.mu.Lock()
	delete(a.sessions, token)
	a.mu.Unlock()
}

func (a *Auth) Resolve(token string) (string, bool) {
	a.mu.RLock()
	s, ok := a.sessions[token]
	a.mu.RUnlock()
	if !ok || time.Now().After(s.ExpiresAt) {
		return "", false
	}
	return s.Username, true
}

func newToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

type ctxKey string

const userCtxKey ctxKey = "user"

func userFromContext(r *http.Request) string {
	if v, ok := r.Context().Value(userCtxKey).(string); ok {
		return v
	}
	return "unknown"
}

// requireAuth wraps a handler, rejecting requests without a valid bearer
// token and attaching the resolved username to the request context so
// handlers can attribute changes to whoever made them.
func (a *Auth) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authz := r.Header.Get("Authorization")
		token := ""
		if strings.HasPrefix(authz, "Bearer ") {
			token = strings.TrimPrefix(authz, "Bearer ")
		}
		if token == "" {
			writeErr(w, http.StatusUnauthorized, "not authenticated")
			return
		}
		username, ok := a.Resolve(token)
		if !ok {
			writeErr(w, http.StatusUnauthorized, "session expired, please log in again")
			return
		}
		ctx := context.WithValue(r.Context(), userCtxKey, username)
		next(w, r.WithContext(ctx))
	}
}
