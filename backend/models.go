package main

import "time"

// SipTrunk represents a carrier SIP trunk we manage (e.g. a lab or prod trunk).
type SipTrunk struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`          // e.g. "Airtel-Lab-01"
	Environment   string    `json:"environment"`    // "lab" | "prod" | custom label
	PilotNumber   string    `json:"pilotNumber"`    // main signalling number
	DIDStart      int64     `json:"didStart"`       // numeric DID range start
	DIDEnd        int64     `json:"didEnd"`         // numeric DID range end (inclusive)
	TotalChannels int       `json:"totalChannels"`  // total concurrent call capacity
	CPS           int       `json:"cps"`            // calls per second cap
	Notes         string    `json:"notes"`
	CreatedAt     time.Time `json:"createdAt"`
}

// Assignment represents a slice of a trunk's channels + a DID block handed to a tenant.
type Assignment struct {
	ID               string    `json:"id"`
	TrunkID          string    `json:"trunkId"`
	TenantName       string    `json:"tenantName"`
	ChannelsAssigned int       `json:"channelsAssigned"`
	DIDStart         int64     `json:"didStart"`
	DIDEnd           int64     `json:"didEnd"` // inclusive
	Notes            string    `json:"notes"`
	CreatedAt        time.Time `json:"createdAt"`
}

// TrunkSummary is a computed view of capacity usage for a trunk.
type TrunkSummary struct {
	Trunk            SipTrunk     `json:"trunk"`
	Assignments      []Assignment `json:"assignments"`
	ChannelsUsed     int          `json:"channelsUsed"`
	ChannelsFree     int          `json:"channelsFree"`
	TotalDIDs        int64        `json:"totalDids"`
	DIDsAssigned     int64        `json:"didsAssigned"`
	DIDsFree         int64        `json:"didsFree"`
}
