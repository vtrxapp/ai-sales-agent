import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Enums, Tables } from "@/lib/types/database.types"
import { normalizePhoneForSending } from "@/lib/services/phone-normalization"

function canonicalPhone(raw: string | null): string | null {
  if (!raw) return null
  const result = normalizePhoneForSending(raw)
  return result.valid ? result.whatsappFormat : null
}

export type SenderMatch = { business: Tables<"businesses">; contact: Tables<"contacts"> | null }

// Reuses the exact phone canonicalization Phase 5 already validated for
// sending, so "who does this WhatsApp number belong to" is judged by the
// same rules as "is this number sendable" - a contact/business number
// stored in any raw format (0771234567 / +263771234567 / 263771234567)
// still matches an inbound sender in any other raw format. Never
// fabricates a match: returns null rather than guessing when nothing
// lines up (spec section 9 - mark UNMATCHED, never attach to the wrong
// business).
export async function matchInboundSender(
  supabase: SupabaseClient<Database>,
  channel: Enums<"outreach_channel">,
  senderIdentifier: string
): Promise<SenderMatch | null> {
  if (channel === "WHATSAPP") {
    const canonical = canonicalPhone(senderIdentifier)
    if (!canonical) return null

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("*")
      .not("whatsapp_number", "is", null)
    if (contactsError) throw new Error(`Failed to search contacts by WhatsApp number: ${contactsError.message}`)
    const matchedContact = contacts.find((c) => canonicalPhone(c.whatsapp_number) === canonical)
    if (matchedContact) {
      const { data: business, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", matchedContact.business_id)
        .single()
      if (error || !business) return null
      return { business, contact: matchedContact }
    }

    const { data: businesses, error: businessesError } = await supabase
      .from("businesses")
      .select("*")
      .not("whatsapp_number", "is", null)
    if (businessesError) throw new Error(`Failed to search businesses by WhatsApp number: ${businessesError.message}`)
    const matchedBusiness = businesses.find((b) => canonicalPhone(b.whatsapp_number) === canonical)
    return matchedBusiness ? { business: matchedBusiness, contact: null } : null
  }

  // EMAIL - exact address match, case-insensitive.
  const normalizedEmail = senderIdentifier.trim().toLowerCase()
  if (!normalizedEmail) return null

  const { data: contacts, error: contactsError } = await supabase.from("contacts").select("*").not("email", "is", null)
  if (contactsError) throw new Error(`Failed to search contacts by email: ${contactsError.message}`)
  const matchedContact = contacts.find((c) => c.email?.toLowerCase() === normalizedEmail)
  if (matchedContact) {
    const { data: business, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", matchedContact.business_id)
      .single()
    if (error || !business) return null
    return { business, contact: matchedContact }
  }

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("*")
    .not("email", "is", null)
  if (businessesError) throw new Error(`Failed to search businesses by email: ${businessesError.message}`)
  const matchedBusiness = businesses.find((b) => b.email?.toLowerCase() === normalizedEmail)
  return matchedBusiness ? { business: matchedBusiness, contact: null } : null
}

// One conversation per (business, channel) - see the migration comment
// for why this is business-level rather than per-contact. Creating one
// also backfills any prior Phase 5 send attempts for this business+
// channel that predate it, so the timeline is complete from the first
// outreach message, not just from the first reply (spec section 6).
export async function findOrCreateConversation(
  supabase: SupabaseClient<Database>,
  businessId: string,
  contactId: string | null,
  channel: Enums<"outreach_channel">,
  provider: string
): Promise<Tables<"conversations">> {
  const { data: existing, error: fetchError } = await supabase
    .from("conversations")
    .select("*")
    .eq("business_id", businessId)
    .eq("channel", channel)
    .maybeSingle()
  if (fetchError) throw new Error(`Failed to look up conversation: ${fetchError.message}`)
  if (existing) return existing

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ business_id: businessId, contact_id: contactId, channel, provider, status: "OPEN" })
    .select()
    .single()
  if (error) throw new Error(`Failed to create conversation: ${error.message}`)

  const { error: backfillError } = await supabase
    .from("outreach_send_attempts")
    .update({ conversation_id: created.id })
    .eq("business_id", businessId)
    .eq("channel", channel)
    .is("conversation_id", null)
  if (backfillError) throw new Error(`Failed to backfill prior sends into conversation: ${backfillError.message}`)

  return created
}
