import type { Tables } from "@/lib/types/database.types"

export type ChannelSelection = {
  channel: "WHATSAPP" | "EMAIL" | "NONE"
  reason: string
}

type BusinessChannelFields = Pick<Tables<"businesses">, "whatsapp_status" | "whatsapp_number" | "email">

// Pure, deterministic. Critical rule (spec section 8): a phone number is
// NEVER automatically treated as a WhatsApp number - only an explicit
// whatsapp_status of AVAILABLE (contact-level or business-level) counts
// as legitimate evidence for recommending WhatsApp. WhatsApp is
// preferred over email when both are legitimately available (dominant
// business-communication channel in Zimbabwe, and the spec's own
// message-structure guidance is WhatsApp-first).
export function determineChannel(
  contact: Tables<"contacts"> | null,
  business: BusinessChannelFields
): ChannelSelection {
  if (contact?.whatsapp_status === "AVAILABLE" && contact.whatsapp_number) {
    return { channel: "WHATSAPP", reason: `${contact.name} has a WhatsApp number on file marked available.` }
  }
  if (business.whatsapp_status === "AVAILABLE" && business.whatsapp_number) {
    return { channel: "WHATSAPP", reason: "The business's own WhatsApp number is on file and marked available." }
  }
  if (contact?.email) {
    return { channel: "EMAIL", reason: `${contact.name} has an email address on file.` }
  }
  if (business.email) {
    return { channel: "EMAIL", reason: "The business's own email address is on file." }
  }
  return { channel: "NONE", reason: "No verified WhatsApp number or email address is available for this business." }
}
