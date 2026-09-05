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
