// MOCK DUPLICATE DETECTION — replace with the real analysis service.
// detectDuplicates() returns a canned set of duplicate groups after a short
// "analysis" delay. The line item IDs reference the seed data so the results
// line up with what's on screen.

import type {
  DateRange,
  DuplicateGroup,
  DuplicateSensitivity,
} from "@/lib/types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detect potential duplicate expense line items within a date range.
 * `sensitivity` would tune the matching thresholds in production; here it only
 * affects which canned LOW-confidence group is included.
 */
export async function detectDuplicates(
  dateRange: DateRange,
  sensitivity: DuplicateSensitivity = "MEDIUM"
): Promise<DuplicateGroup[]> {
  await sleep(2000);

  const groups: DuplicateGroup[] = [
    {
      duplicateGroupId: "dup-group-001",
      confidence: "HIGH",
      reason:
        "Same merchant (Delta Air Lines) and identical amount ($418.40) submitted on two reports within 3 days.",
      lineItemIds: ["line-003", "line-012"],
      totalDuplicatedAmount: 418.4,
      recommendedAction: "Remove the duplicate line item from one report.",
    },
    {
      duplicateGroupId: "dup-group-002",
      confidence: "MEDIUM",
      reason:
        "Two mileage entries of 36 miles to the same airport on overlapping trips.",
      lineItemIds: ["line-009", "line-013"],
      totalDuplicatedAmount: 26.1,
      recommendedAction: "Verify both trips actually occurred before approving.",
    },
  ];

  // Only surface the weakest match when sensitivity is turned up.
  if (sensitivity === "HIGH") {
    groups.push({
      duplicateGroupId: "dup-group-003",
      confidence: "LOW",
      reason:
        "Two local meals on consecutive days with similar amounts; possible double entry.",
      lineItemIds: ["line-002", "line-006"],
      totalDuplicatedAmount: 22.5,
      recommendedAction:
        "Low confidence — review receipts to confirm these are distinct meals.",
    });
  }

  return groups;
}
