import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Enums, Tables } from "@/lib/types/database.types"
import { logActivity } from "@/lib/services/activity-service"

export type CreateContactInput = {
  businessId: string
  name: string
  jobTitle?: string | null
  email?: string | null
  phone?: string | null
  whatsappNumber?: string | null
  whatsappStatus?: Enums<"whatsapp_status">
  socialUrl?: string | null
  source: string
  verificationStatus?: Enums<"contact_verification_status">
}

export async function listContacts(
  supabase: SupabaseClient<Database>,
  businessId: string
): Promise<Tables<"contacts">[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Failed to load contacts: ${error.message}`)
  return data
}

export async function createContact(
  supabase: SupabaseClient<Database>,
  input: CreateContactInput,
  actorId: string
): Promise<Tables<"contacts">> {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", input.businessId)
    .single()
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`)

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      business_id: input.businessId,
      name: input.name,
      job_title: input.jobTitle ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      whatsapp_number: input.whatsappNumber ?? null,
      whatsapp_status: input.whatsappStatus ?? "UNKNOWN",
      social_url: input.socialUrl ?? null,
      source: input.source,
      verification_status: input.verificationStatus ?? "UNKNOWN",
      created_by: actorId,
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create contact: ${error.message}`)

  await logActivity(supabase, {
    entityType: "business",
    entityId: input.businessId,
    activityType: "CONTACT_ADDED",
    description: `${contact.name} was added as a contact for "${business.name}".`,
    productId: null,
    actorId,
    metadata: { contact_id: contact.id, source: input.source },
  })

  return contact
}
