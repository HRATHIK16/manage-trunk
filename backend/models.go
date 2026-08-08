package main

import "time"

// DIDRange is one inclusive block of DIDs, e.g. 1000-2000. Most trunks have
// exactly one block, but a trunk can have several non-contiguous ones.
type DIDRange struct {
	Start int64 `json:"start"`
	End   int64 `json:"end"` // inclusive
}

// Size returns how many DIDs are in this range (0 if malformed).
func (r DIDRange) Size() int64 {
	if r.End < r.Start {
		return 0
	}
	return r.End - r.Start + 1
}

// Contains reports whether [start,end] falls entirely within this range.
func (r DIDRange) Contains(start, end int64) bool {
	return start >= r.Start && end <= r.End
}

// overlaps reports whether this range shares any DID with [start,end].
func (r DIDRange) overlaps(start, end int64) bool {
	return start <= r.End && r.Start <= end
}

// SipTrunk represents a carrier SIP trunk we manage (e.g. a lab or prod trunk).
type SipTrunk struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Environment   string     `json:"environment"` // "prod" | "lab"
	PilotNumber   string     `json:"pilotNumber"`
	DIDRanges     []DIDRange `json:"didRanges"`
	TotalChannels int        `json:"totalChannels"`
	CPS           int        `json:"cps"`
	Notes         string     `json:"notes"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// TotalDIDs sums the size of every DID range on the trunk.
func (t SipTrunk) TotalDIDs() int64 {
	var total int64
	for _, r := range t.DIDRanges {
		total += r.Size()
	}
	return total
}

// ContainsRange reports whether [start,end] fits entirely inside one of the
// trunk's DID ranges. An assignment can't straddle two separate blocks.
func (t SipTrunk) ContainsRange(start, end int64) bool {
	for _, r := range t.DIDRanges {
		if r.Contains(start, end) {
			return true
		}
	}
	return false
}

// Assignment represents a slice of a trunk's channels + one or more DID
// blocks handed to a tenant. Most tenants get a single contiguous block,
// but some end up with a few scattered ones (e.g. 1000-1100 and
// 1500-1600), so this mirrors how SipTrunk.DIDRanges works.
type Assignment struct {
	ID               string     `json:"id"`
	TrunkID          string     `json:"trunkId"`
	TenantName       string     `json:"tenantName"`
	ChannelsAssigned int        `json:"channelsAssigned"`
	DIDRanges        []DIDRange `json:"didRanges"`
	Notes            string     `json:"notes"`
	CreatedAt        time.Time  `json:"createdAt"`
}

// TotalDIDs sums the size of every DID range on the assignment.
func (a Assignment) TotalDIDs() int64 {
	var total int64
	for _, r := range a.DIDRanges {
		total += r.Size()
	}
	return total
}

// TrunkSummary is a computed view of capacity usage for a trunk.
type TrunkSummary struct {
	Trunk         SipTrunk     `json:"trunk"`
	Assignments   []Assignment `json:"assignments"`
	ChannelsUsed  int          `json:"channelsUsed"`
	ChannelsFree  int          `json:"channelsFree"`
	TotalDIDs     int64        `json:"totalDids"`
	DIDsAssigned  int64        `json:"didsAssigned"`
	DIDsFree      int64        `json:"didsFree"`
	FreeDIDRanges []DIDRange   `json:"freeDidRanges"`
}
