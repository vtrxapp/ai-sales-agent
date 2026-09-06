import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Enums } from "@/lib/types/database.types"

export type OverviewStats = {
  totalProducts: number
  totalCampaigns: number
  activeCampaigns: number
  campaignsByProduct: Record<string, number>
}

const EMPTY_STATUS_COUNTS: Record<Enums<"campaign_status">, number> = {
  DRAFT: 0,
  ACTIVE: 0,
  PAUSED: 0,
  COMPLETED: 0,
  ARCHIVED: 0,
}

export type CampaignStatsInput = {
  product_id: string
  status: Enums<"campaign_status">
}[]

// Pure aggregation, kept separate from the fetch so it's unit-testable
// without mocking the Supabase client - see lib/services/__tests__.
export function summarizeCampaigns(
  campaigns: CampaignStatsInput,
  totalProducts: number
): OverviewStats {
  const statusCounts = { ...EMPTY_STATUS_COUNTS }
  const campaignsByProduct: Record<string, number> = {}

  for (const campaign of campaigns) {
    statusCounts[campaign.status] += 1
    campaignsByProduct[campaign.product_id] =
      (campaignsByProduct[campaign.product_id] ?? 0) + 1
  }

  return {
    totalProducts,
    totalCampaigns: campaigns.length,
    activeCampaigns: statusCounts.ACTIVE,
    campaignsByProduct,
  }
}

// Traffic/conversion KPIs from the full spec still need tables that arrive
// in later phases (campaign_events/signatures in Phase 6-7). Rather than
// fabricate zeros for those, callers should render "not available yet" -
// see app/(dashboard)/overview/page.tsx.
export async function getOverviewStats(
  supabase: SupabaseClient<Database>
): Promise<OverviewStats> {
  const [{ count: totalProducts }, campaigns] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("campaigns").select("id, product_id, status"),
  ])

  if (campaigns.error) {
    throw new Error(`Failed to load campaign stats: ${campaigns.error.message}`)
  }

  return summarizeCampaigns(campaigns.data, totalProducts ?? 0)
}

export type PipelineStats = {
  totalProspects: number
  statusCounts: Record<Enums<"pipeline_status">, number>
  scoredCount: number
  highValueUncontactedCount: number
}

const EMPTY_PIPELINE_STATUS_COUNTS: Record<Enums<"pipeline_status">, number> = {
  NEW: 0,
  QUALIFIED: 0,
  CONTACTED: 0,
  REPLIED: 0,
  MEETING: 0,
  PROPOSAL: 0,
  WON: 0,
  LOST: 0,
}

export type PipelineStatsInput = {
  pipeline_status: Enums<"pipeline_status">
  classification: Enums<"lead_classification"> | null
}[]

// Pure aggregation - unit-testable without mocking Supabase.
export function summarizePipeline(businesses: PipelineStatsInput): PipelineStats {
  const statusCounts = { ...EMPTY_PIPELINE_STATUS_COUNTS }
  let scoredCount = 0
  let highValueUncontactedCount = 0

  for (const business of businesses) {
    statusCounts[business.pipeline_status] += 1
    if (business.classification) {
      scoredCount += 1
      if (
        (business.classification === "EXCEPTIONAL" || business.classification === "HIGH") &&
        business.pipeline_status === "NEW"
      ) {
        highValueUncontactedCount += 1
      }
    }
  }

  return {
    totalProspects: businesses.length,
    statusCounts,
    scoredCount,
    highValueUncontactedCount,
  }
}

export type OutreachStats = {
  qualifiedProspects: number
  prospectsWithOpportunities: number
  prospectsReadyForOutreach: number
  draftsAwaitingReview: number
  approvedDrafts: number
  highPriorityOpportunities: number
}

// Real database counts only - no fabricated numbers (spec section 34).
// "Ready for outreach" and "with opportunities" are computed as distinct
// businesses, not row counts, since a business can have several
// opportunities/one active strategy.
export async function getOutreachStats(supabase: SupabaseClient<Database>): Promise<OutreachStats> {
  const [qualifiedResult, opportunitiesResult, strategiesResult, needsReviewResult, approvedResult, highPriorityResult] =
    await Promise.all([
      supabase.from("businesses").select("*", { count: "exact", head: true }).eq("pipeline_status", "QUALIFIED"),
      supabase.from("opportunities").select("business_id").not("status", "eq", "REJECTED").not("status", "eq", "CLOSED"),
      supabase.from("sales_strategies").select("business_id, recommended_channel").eq("status", "ACTIVE"),
      supabase.from("outreach_drafts").select("*", { count: "exact", head: true }).eq("status", "NEEDS_REVIEW"),
      supabase.from("outreach_drafts").select("*", { count: "exact", head: true }).eq("status", "READY_TO_SEND"),
      supabase.from("opportunities").select("status").in("priority", ["CRITICAL", "HIGH"]),
    ])

  if (qualifiedResult.error) throw new Error(`Failed to load qualified prospect count: ${qualifiedResult.error.message}`)
  if (opportunitiesResult.error) throw new Error(`Failed to load opportunities: ${opportunitiesResult.error.message}`)
  if (strategiesResult.error) throw new Error(`Failed to load sales strategies: ${strategiesResult.error.message}`)
  if (needsReviewResult.error) throw new Error(`Failed to load drafts needing review: ${needsReviewResult.error.message}`)
  if (approvedResult.error) throw new Error(`Failed to load approved drafts: ${approvedResult.error.message}`)
  if (highPriorityResult.error) throw new Error(`Failed to load high-priority opportunities: ${highPriorityResult.error.message}`)

  const prospectsWithOpportunities = new Set(opportunitiesResult.data.map((o) => o.business_id)).size
  const prospectsReadyForOutreach = new Set(
    strategiesResult.data.filter((s) => s.recommended_channel !== "NONE").map((s) => s.business_id)
  ).size
  const highPriorityOpportunities = highPriorityResult.data.filter(
    (o) => o.status !== "REJECTED" && o.status !== "CLOSED"
  ).length

  return {
    qualifiedProspects: qualifiedResult.count ?? 0,
    prospectsWithOpportunities,
    prospectsReadyForOutreach,
    draftsAwaitingReview: needsReviewResult.count ?? 0,
    approvedDrafts: approvedResult.count ?? 0,
    highPriorityOpportunities,
  }
}

export async function getPipelineStats(supabase: SupabaseClient<Database>): Promise<PipelineStats> {
  const { data, error } = await supabase
    .from("businesses")
    .select("pipeline_status, lead_scores(classification)")
    .returns<{ pipeline_status: Enums<"pipeline_status">; lead_scores: { classification: Enums<"lead_classification"> }[] | { classification: Enums<"lead_classification"> } | null }[]>()

  if (error) throw new Error(`Failed to load pipeline stats: ${error.message}`)

  return summarizePipeline(
    data.map((row) => {
      const leadScore = Array.isArray(row.lead_scores) ? (row.lead_scores[0] ?? null) : row.lead_scores
      return { pipeline_status: row.pipeline_status, classification: leadScore?.classification ?? null }
    })
  )
}
