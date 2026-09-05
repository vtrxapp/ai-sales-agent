import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Enums, Tables } from "@/lib/types/database.types"
import { logActivity } from "@/lib/services/activity-service"

// Manual creation and listing, used by the "Add opportunity" form.
// estimated_value is never set here - no pricing without configured
// pricing rules (a later phase). AI-detected opportunities go through
// upsertDetectedOpportunity below instead, for dedup and scoring.
export type CreateOpportunityInput = {
  businessId: string
  opportunityType: Enums<"opportunity_type">
  title: string
  description?: string | null
  problem?: string | null
  proposedSolution?: string | null
  priority?: Enums<"opportunity_priority">
}

export async function listOpportunities(
  supabase: SupabaseClient<Database>,
  businessId: string
): Promise<Tables<"opportunities">[]> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Failed to load opportunities: ${error.message}`)
  return data
}

export async function createOpportunity(
  supabase: SupabaseClient<Database>,
  input: CreateOpportunityInput,
  actorId: string
): Promise<Tables<"opportunities">> {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", input.businessId)
    .single()
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`)

  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .insert({
      business_id: input.businessId,
      opportunity_type: input.opportunityType,
      title: input.title,
      title_normalized: normalizeOpportunityTitle(input.title),
      description: input.description ?? null,
      problem: input.problem ?? null,
      proposed_solution: input.proposedSolution ?? null,
      priority: input.priority ?? "MEDIUM",
      source: "manual",
      created_by: actorId,
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create opportunity: ${error.message}`)

  await logActivity(supabase, {
    entityType: "business",
    entityId: input.businessId,
    activityType: "OPPORTUNITY_CREATED",
    description: `Opportunity "${opportunity.title}" was added for "${business.name}".`,
    productId: null,
    actorId,
    metadata: { opportunity_id: opportunity.id, opportunity_type: opportunity.opportunity_type },
  })

  return opportunity
}

export async function updateOpportunityStatus(
  supabase: SupabaseClient<Database>,
  opportunityId: string,
  status: Enums<"opportunity_status">,
  actorId: string
): Promise<Tables<"opportunities">> {
  const { data: existing, error: fetchError } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", opportunityId)
    .single()
  if (fetchError) throw new Error(`Failed to load opportunity: ${fetchError.message}`)

  if (existing.status === status) return existing

  const { data: updated, error } = await supabase
    .from("opportunities")
    .update({ status })
    .eq("id", opportunityId)
    .select()
    .single()
  if (error) throw new Error(`Failed to update opportunity status: ${error.message}`)

  await logActivity(supabase, {
    entityType: "business",
    entityId: updated.business_id,
    activityType: "OPPORTUNITY_STATUS_CHANGED",
    description: `Opportunity "${updated.title}" moved from ${existing.status} to ${status}.`,
    productId: null,
    actorId,
    metadata: { opportunity_id: updated.id, from: existing.status, to: status },
  })

  return updated
}

// Pure - unit-testable. Whitespace-insensitive, case-insensitive match key
// used everywhere an opportunity might be detected again by a later
// research/audit run. Deliberately no fuzzy similarity matching: a
// slightly different title is treated as a different opportunity rather
// than risk silently merging two distinct problems (same philosophy as
// deduplication-service.ts's "never merge on name similarity alone").
export function normalizeOpportunityTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ")
}

export type OpportunityScoreComponents = {
  business_impact_score: number
  evidence_strength_score: number
  customer_need_score: number
  commercial_fit_score: number
  urgency_score: number
  feasibility_score: number
}

// Pure - unit-testable. Component maxima (25/20/15/15/10/15) match the
// spec's weighting exactly; the service layer always recomputes this
// from validated components rather than trusting any AI-stated total, so
// the score is explainable by construction, never an arbitrary number.
export function computeOpportunityScore(components: OpportunityScoreComponents): number {
  return (
    components.business_impact_score +
    components.evidence_strength_score +
    components.customer_need_score +
    components.commercial_fit_score +
    components.urgency_score +
    components.feasibility_score
  )
}

export function classifyOpportunityPriority(score: number): Enums<"opportunity_priority"> {
  if (score >= 85) return "CRITICAL"
  if (score >= 65) return "HIGH"
  if (score >= 40) return "MEDIUM"
  return "LOW"
}

// Dedup lookup shared by the AI opportunity pipeline (upsertDetectedOpportunity
// below) and the legacy research-proposed path (lead-research-service.ts) -
// exact match on (business_id, opportunity_type, normalized title) only.
export async function findMatchingOpportunity(
  supabase: SupabaseClient<Database>,
  businessId: string,
  opportunityType: Enums<"opportunity_type">,
  title: string
): Promise<Tables<"opportunities"> | null> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("business_id", businessId)
    .eq("opportunity_type", opportunityType)
    .eq("title_normalized", normalizeOpportunityTitle(title))
    .maybeSingle()
  if (error) throw new Error(`Failed to look up existing opportunities: ${error.message}`)
  return data
}

export type OpportunityScoreReasoning = {
  business_impact: string
  evidence_strength: string
  customer_need: string
  commercial_fit: string
  urgency: string
  feasibility: string
}

export type DetectedOpportunityInput = {
  businessId: string
  opportunityType: Enums<"opportunity_type">
  title: string
  description: string
  problem: string
  evidence: string
  proposedSolution: string
  recommendedService: string
  expectedBenefit: string
  estimatedComplexity: Enums<"opportunity_complexity">
  confidence: number
  scoreComponents: OpportunityScoreComponents & { reasoning: OpportunityScoreReasoning }
  auditId: string | null
}

export type UpsertOpportunityResult = {
  opportunity: Tables<"opportunities">
  wasReDetected: boolean
}

// The full Phase 3 opportunity pipeline (OpportunityAnalysisService) always
// has evidence and score components, so this always writes them - it
// matches on (business_id, opportunity_type, normalized title): update in
// place and bump times_detected on a match, insert fresh otherwise, never
// delete history. This is what closes the Phase 2 gap where a repeated
// research run created a fresh duplicate opportunity every time.
export async function upsertDetectedOpportunity(
  supabase: SupabaseClient<Database>,
  input: DetectedOpportunityInput,
  actorId: string
): Promise<UpsertOpportunityResult> {
  const existing = await findMatchingOpportunity(supabase, input.businessId, input.opportunityType, input.title)
  const score = computeOpportunityScore(input.scoreComponents)
  const priority = classifyOpportunityPriority(score)

  const sharedFields = {
    title: input.title,
    title_normalized: normalizeOpportunityTitle(input.title),
    description: input.description,
    problem: input.problem,
    evidence: input.evidence,
    proposed_solution: input.proposedSolution,
    recommended_service: input.recommendedService,
    expected_benefit: input.expectedBenefit,
    estimated_complexity: input.estimatedComplexity,
    confidence: input.confidence,
    priority,
    score,
    business_impact_score: input.scoreComponents.business_impact_score,
    evidence_strength_score: input.scoreComponents.evidence_strength_score,
    customer_need_score: input.scoreComponents.customer_need_score,
    commercial_fit_score: input.scoreComponents.commercial_fit_score,
    urgency_score: input.scoreComponents.urgency_score,
    feasibility_score: input.scoreComponents.feasibility_score,
    score_reasoning: input.scoreComponents.reasoning,
    audit_id: input.auditId,
  }

  if (existing) {
    const { data: updated, error } = await supabase
      .from("opportunities")
      .update({
        ...sharedFields,
        last_detected_at: new Date().toISOString(),
        times_detected: existing.times_detected + 1,
      })
      .eq("id", existing.id)
      .select()
      .single()
    if (error) throw new Error(`Failed to update opportunity: ${error.message}`)

    await logActivity(supabase, {
      entityType: "business",
      entityId: input.businessId,
      activityType: "OPPORTUNITY_RE_DETECTED",
      description: `Opportunity "${updated.title}" was detected again (now seen ${updated.times_detected} times).`,
      productId: null,
      actorId,
      metadata: { opportunity_id: updated.id, times_detected: updated.times_detected, score },
    })
    return { opportunity: updated, wasReDetected: true }
  }

  const { data: created, error } = await supabase
    .from("opportunities")
    .insert({
      business_id: input.businessId,
      opportunity_type: input.opportunityType,
      source: "ai_opportunity_analysis",
      created_by: actorId,
      ...sharedFields,
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create opportunity: ${error.message}`)

  await logActivity(supabase, {
    entityType: "business",
    entityId: input.businessId,
    activityType: "OPPORTUNITY_DETECTED",
    description: `New opportunity "${created.title}" identified (${priority} priority, score ${score}/100).`,
    productId: null,
    actorId,
    metadata: { opportunity_id: created.id, opportunity_type: created.opportunity_type, score },
  })
  return { opportunity: created, wasReDetected: false }
}
