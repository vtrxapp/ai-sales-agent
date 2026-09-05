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

// Phase 1 only has products/campaigns/activities. Lead, pipeline, and
// traffic/conversion KPIs from the full spec need tables that arrive in
// later phases (businesses/opportunities in Phase 2-4, campaign_events/
// signatures in Phase 6-7). Rather than fabricate zeros for those, callers
// should render "not available yet" - see app/(dashboard)/overview/page.tsx.
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
