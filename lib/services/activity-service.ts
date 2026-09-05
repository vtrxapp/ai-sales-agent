import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json, Tables } from "@/lib/types/database.types"

export type LogActivityInput = {
  entityType: string
  entityId?: string | null
  activityType: string
  description: string
  productId?: string | null
  campaignId?: string | null
  actorId?: string | null
  metadata?: Record<string, Json>
}

export async function logActivity(
  supabase: SupabaseClient<Database>,
  input: LogActivityInput
): Promise<Tables<"activities">> {
  const { data, error } = await supabase
    .from("activities")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      activity_type: input.activityType,
      description: input.description,
      product_id: input.productId ?? null,
      campaign_id: input.campaignId ?? null,
      actor_id: input.actorId ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to log activity: ${error.message}`)
  return data
}

export async function listRecentActivities(
  supabase: SupabaseClient<Database>,
  limit = 10,
  filters?: { campaignId?: string }
): Promise<Tables<"activities">[]> {
  let query = supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (filters?.campaignId) {
    query = query.eq("campaign_id", filters.campaignId)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to load activities: ${error.message}`)
  return data
}
