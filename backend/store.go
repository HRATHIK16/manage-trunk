package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"crypto/rand"
)

const dataFile = "data.json"

type dataSnapshot struct {
	Trunks      map[string]SipTrunk    `json:"trunks"`
	Assignments map[string]Assignment  `json:"assignments"`
}

// Store is a simple thread-safe in-memory store, persisted to a JSON file
// on every write so restarting the server doesn't lose data. No external
// database dependency is used on purpose, to keep this deployable anywhere
// a Go toolchain exists with zero extra downloads.
type Store struct {
	mu          sync.RWMutex
	trunks      map[string]SipTrunk
	assignments map[string]Assignment
}

func NewStore() *Store {
	s := &Store{
		trunks:      map[string]SipTrunk{},
		assignments: map[string]Assignment{},
	}
	s.load()
	return s
}

func newID(prefix string) string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s_%x", prefix, b)
}

func (s *Store) load() {
	raw, err := os.ReadFile(dataFile)
	if err != nil {
		return // no file yet, start fresh
	}
	var snap dataSnapshot
	if err := json.Unmarshal(raw, &snap); err != nil {
		return
	}
	if snap.Trunks != nil {
		s.trunks = snap.Trunks
	}
	if snap.Assignments != nil {
		s.assignments = snap.Assignments
	}
}

// persist must be called while NOT holding the lock's write side externally
// mismanaged; callers hold s.mu already, so this assumes the lock is held.
func (s *Store) persistLocked() {
	snap := dataSnapshot{Trunks: s.trunks, Assignments: s.assignments}
	raw, err := json.MarshalIndent(snap, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(dataFile, raw, 0644)
}

// ---- Trunks ----

func (s *Store) ListTrunks() []SipTrunk {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]SipTrunk, 0, len(s.trunks))
	for _, t := range s.trunks {
		out = append(out, t)
	}
	return out
}

func (s *Store) GetTrunk(id string) (SipTrunk, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.trunks[id]
	return t, ok
}

func (s *Store) CreateTrunk(t SipTrunk) SipTrunk {
	s.mu.Lock()
	defer s.mu.Unlock()
	t.ID = newID("trunk")
	t.CreatedAt = time.Now().UTC()
	s.trunks[t.ID] = t
	s.persistLocked()
	return t
}

func (s *Store) DeleteTrunk(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.trunks[id]; !ok {
		return false
	}
	delete(s.trunks, id)
	for aid, a := range s.assignments {
		if a.TrunkID == id {
			delete(s.assignments, aid)
		}
	}
	s.persistLocked()
	return true
}

// ---- Assignments ----

func (s *Store) ListAssignmentsForTrunk(trunkID string) []Assignment {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []Assignment{}
	for _, a := range s.assignments {
		if a.TrunkID == trunkID {
			out = append(out, a)
		}
	}
	return out
}

func (s *Store) CreateAssignment(a Assignment) (Assignment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	trunk, ok := s.trunks[a.TrunkID]
	if !ok {
		return Assignment{}, fmt.Errorf("trunk not found")
	}

	// Validate DID range is within the trunk's DID range
	if a.DIDStart > a.DIDEnd {
		return Assignment{}, fmt.Errorf("did range start must be <= end")
	}
	if a.DIDStart < trunk.DIDStart || a.DIDEnd > trunk.DIDEnd {
		return Assignment{}, fmt.Errorf("did range must fall within the trunk's did range (%d-%d)", trunk.DIDStart, trunk.DIDEnd)
	}

	existing := []Assignment{}
	for _, ex := range s.assignments {
		if ex.TrunkID == a.TrunkID {
			existing = append(existing, ex)
		}
	}

	// Validate channel capacity
	channelsUsed := 0
	for _, ex := range existing {
		channelsUsed += ex.ChannelsAssigned
	}
	if channelsUsed+a.ChannelsAssigned > trunk.TotalChannels {
		return Assignment{}, fmt.Errorf("not enough free channels: trunk has %d total, %d already assigned, requested %d",
			trunk.TotalChannels, channelsUsed, a.ChannelsAssigned)
	}

	// Validate DID overlap
	for _, ex := range existing {
		if a.DIDStart <= ex.DIDEnd && ex.DIDStart <= a.DIDEnd {
			return Assignment{}, fmt.Errorf("did range overlaps existing assignment to %q (%d-%d)", ex.TenantName, ex.DIDStart, ex.DIDEnd)
		}
	}

	a.ID = newID("asn")
	a.CreatedAt = time.Now().UTC()
	s.assignments[a.ID] = a
	s.persistLocked()
	return a, nil
}

func (s *Store) DeleteAssignment(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.assignments[id]; !ok {
		return false
	}
	delete(s.assignments, id)
	s.persistLocked()
	return true
}

func (s *Store) Summary(trunkID string) (TrunkSummary, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	trunk, ok := s.trunks[trunkID]
	if !ok {
		return TrunkSummary{}, fmt.Errorf("trunk not found")
	}
	assignments := []Assignment{}
	channelsUsed := 0
	var didsAssigned int64
	for _, a := range s.assignments {
		if a.TrunkID == trunkID {
			assignments = append(assignments, a)
			channelsUsed += a.ChannelsAssigned
			didsAssigned += a.DIDEnd - a.DIDStart + 1
		}
	}
	totalDIDs := trunk.DIDEnd - trunk.DIDStart + 1
	return TrunkSummary{
		Trunk:        trunk,
		Assignments:  assignments,
		ChannelsUsed: channelsUsed,
		ChannelsFree: trunk.TotalChannels - channelsUsed,
		TotalDIDs:    totalDIDs,
		DIDsAssigned: didsAssigned,
		DIDsFree:     totalDIDs - didsAssigned,
	}, nil
}
