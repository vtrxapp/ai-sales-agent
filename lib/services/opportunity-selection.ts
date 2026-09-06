import type { Tables } from "@/lib/types/database.types"

export type SelectableOpportunity = Pick<
  Tables<"opportunities">,
  "status" | "score" | "business_impact_score" | "evidence_strength_score"
>

export type OpportunitySelection<T> = {
  primary: T | null
  secondary: T[]
}

const ACTIVE_STATUSES: ReadonlySet<Tables<"opportunities">["status"]> = new Set([
  "IDENTIFIED",
  "QUALIFIED",
  "PRESENTED",
  "ACCEPTED",
])

// Pure, deterministic - not an AI call (spec: "create a deterministic
// server-side selection mechanism where practical"). Excludes
// REJECTED/CLOSED opportunities, then ranks by the already-validated
// 0-100 score - itself a weighted composite of business impact/evidence
// strength/customer need/commercial fit/urgency/feasibility (see
// computeOpportunityScore in opportunity-service.ts), so "not simply the
// highest numerical score" is satisfied by construction: the score IS a
// considered composite, not a naive metric. Ties break on
// business_impact_score, then evidence_strength_score. An opportunity
// with no score yet (legacy Phase 2 manual/research-only rows) sorts
// last - there is nothing to rank it on.
//
// Generic over T (constrained to the fields actually used for ranking)
// so this same logic serves both a full opportunity row (sales strategy
// generation) and the narrower projection the prospects list view
// fetches for its filters/sorts.
export function selectPrimaryOpportunity<T extends SelectableOpportunity>(
  opportunities: T[]
): OpportunitySelection<T> {
  const active = opportunities.filter((o) => ACTIVE_STATUSES.has(o.status))

  const ranked = [...active].sort((a, b) => {
    const scoreDiff = (b.score ?? -1) - (a.score ?? -1)
    if (scoreDiff !== 0) return scoreDiff
    const impactDiff = (b.business_impact_score ?? -1) - (a.business_impact_score ?? -1)
    if (impactDiff !== 0) return impactDiff
    return (b.evidence_strength_score ?? -1) - (a.evidence_strength_score ?? -1)
  })

  return {
    primary: ranked[0] ?? null,
    secondary: ranked.slice(1, 3),
  }
}

const SENTINEL_NO_MATCHING_SERVICE = "NO_MATCHING_SERVICE"

// Pure. The "existing product/service structure" (spec section 29) in
// this app is opportunity_type - the enum already used throughout Phases
// 2-3 as Zviko Labs' extensible service catalog - plus the opportunity's
// own recommended_service text where Phase 3 already grounded it in
// evidence. Never invents a new service name; returns the literal
// sentinel only when neither is usable.
export function resolveRecommendedService(opportunity: Tables<"opportunities">): string {
  if (opportunity.recommended_service && opportunity.recommended_service.trim().length > 0) {
    return opportunity.recommended_service
  }
  if (opportunity.opportunity_type !== "OTHER") {
    return humanizeOpportunityType(opportunity.opportunity_type)
  }
  return SENTINEL_NO_MATCHING_SERVICE
}

function humanizeOpportunityType(type: Tables<"opportunities">["opportunity_type"]): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
