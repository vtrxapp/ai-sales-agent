import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Enums, Tables } from "@/lib/types/database.types"
import { logActivity } from "@/lib/services/activity-service"

// Foundation only (Phase 3 expands this into the full Opportunity Engine):
// manual creation and listing. estimated_value is never set here - no
// pricing without configured pricing rules (a later phase).
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
