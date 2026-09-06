import type { Tables } from "@/lib/types/database.types"

// Architecture prepared for Phase 5 - NOT implemented here. No code in
// this phase calls anything through this interface; there is no
// concrete WhatsAppProvider/EmailProvider yet, and none should be added
// until Phase 5 explicitly implements actual sending via the official
// WhatsApp Business Platform / an email provider. This exists purely so
// the outreach intelligence layer (SalesStrategyService,
// OutreachDraftService) never has to change shape when that lands.
export type OutreachRecipient = {
  name: string | null
  phone?: string | null
  email?: string | null
}

export type OutreachSendResult = {
  success: boolean
  providerMessageId?: string
  error?: string
}

export interface OutreachProvider {
  readonly channel: "WHATSAPP" | "EMAIL"
  send(draft: Tables<"outreach_drafts">, recipient: OutreachRecipient): Promise<OutreachSendResult>
}
