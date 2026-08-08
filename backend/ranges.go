package main

import (
	"fmt"
	"sort"
	"strings"
)

// formatDIDRanges renders ranges as "1000-1100, 1500-1600" for audit
// messages and other human-readable output.
func formatDIDRanges(ranges []DIDRange) string {
	parts := make([]string, len(ranges))
	for i, r := range ranges {
		parts[i] = fmt.Sprintf("%d-%d", r.Start, r.End)
	}
	return strings.Join(parts, ", ")
}

// validateDIDRanges checks that a trunk's proposed DID ranges are individually
// well-formed and don't overlap each other.
func validateDIDRanges(ranges []DIDRange) string {
	if len(ranges) == 0 {
		return "at least one did range is required"
	}
	sorted := make([]DIDRange, len(ranges))
	copy(sorted, ranges)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Start < sorted[j].Start })

	for i, r := range sorted {
		if r.Start <= 0 || r.End <= 0 {
			return "did ranges must use positive numbers"
		}
		if r.Start > r.End {
			return "each did range's start must be <= its end"
		}
		if i > 0 && sorted[i-1].overlaps(r.Start, r.End) {
			return fmt.Sprintf("did ranges overlap: %d-%d and %d-%d", sorted[i-1].Start, sorted[i-1].End, r.Start, r.End)
		}
	}
	return ""
}

// rangesOverlap reports whether any range in a overlaps any range in b,
// returning the first offending pair found.
func rangesOverlap(a, b []DIDRange) (DIDRange, DIDRange, bool) {
	for _, ra := range a {
		for _, rb := range b {
			if ra.overlaps(rb.Start, rb.End) {
				return ra, rb, true
			}
		}
	}
	return DIDRange{}, DIDRange{}, false
}

// computeFreeDIDRanges subtracts a set of assigned (used) ranges from a
// trunk's DID ranges, returning whatever's left over. `used` ranges are
// assumed to each fall entirely within one of `trunkRanges` (validated at
// assignment time) but may arrive in any order.
func computeFreeDIDRanges(trunkRanges []DIDRange, used []DIDRange) []DIDRange {
	free := []DIDRange{}
	for _, block := range trunkRanges {
		// collect the used ranges that fall inside this block, sorted by start
		var inBlock []DIDRange
		for _, u := range used {
			if u.Start >= block.Start && u.End <= block.End {
				inBlock = append(inBlock, u)
			}
		}
		sort.Slice(inBlock, func(i, j int) bool { return inBlock[i].Start < inBlock[j].Start })

		cursor := block.Start
		for _, u := range inBlock {
			if u.Start > cursor {
				free = append(free, DIDRange{Start: cursor, End: u.Start - 1})
			}
			if u.End+1 > cursor {
				cursor = u.End + 1
			}
		}
		if cursor <= block.End {
			free = append(free, DIDRange{Start: cursor, End: block.End})
		}
	}
	return free
}
