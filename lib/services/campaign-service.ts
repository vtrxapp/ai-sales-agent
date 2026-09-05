import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Tables } from "@/lib/types/database.types"
import type { CampaignFormInput } from "@/lib/validations/campaign"
import { logActivity } from "@/lib/services/activity-service"

export type CampaignWithProduct = Tables<"campaigns"> & {
  products: Pick<Tables<"products">, "id" | "name" | "slug"> | null
}

export async function listCampaigns(
  supabase: SupabaseClient<Database>,
  filters?: { productId?: string }
): Promise<CampaignWithProduct[]> {
  let query = supabase
    .from("campaigns")
    .select("*, products ( id, name, slug )")
    .order("created_at", { ascending: false })

  if (filters?.productId) {
    query = query.eq("product_id", filters.productId)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to load campaigns: ${error.message}`)
  return data
}

export async function getCampaignById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<CampaignWithProduct | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, products ( id, name, slug )")
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(`Failed to load campaign: ${error.message}`)
  return data
}

export function emptyToNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null
}

export async function createCampaign(
  supabase: SupabaseClient<Database>,
  input: CampaignFormInput,
  actorId: string
): Promise<Tables<"campaigns">> {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      product_id: input.product_id,
      name: input.name,
      description: emptyToNull(input.description),
      campaign_type: input.campaign_type,
      objective: emptyToNull(input.objective),
      target_location: emptyToNull(input.target_location),
      target_audience: emptyToNull(input.target_audience),
      start_date: emptyToNull(input.start_date),
      end_date: emptyToNull(input.end_date),
      budget: input.budget ? Number(input.budget) : null,
      created_by: actorId,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create campaign: ${error.message}`)

  await logActivity(supabase, {
    entityType: "campaign",
    entityId: campaign.id,
    activityType: "CAMPAIGN_CREATED",
    description: `Campaign "${campaign.name}" was created.`,
    productId: campaign.product_id,
    campaignId: campaign.id,
    actorId,
  })

  return campaign
}
