import type { Tables } from "@/lib/types/database.types"

// Recipient resolved server-side from trusted database rows (contact or
// business fallback) - never client-supplied. A send-path caller must
// never trust a client request to say who the recipient is; the send
// service resolves this itself from the draft's stored business/contact.
export type OutreachRecipient = {
  name: string | null
  phone?: string | null
  email?: string | null
}

export type OutreachSendSuccess = {
  success: true
  providerMessageId: string
  providerName: string
}

// retryable distinguishes a temporary provider/network failure (safe to
// let the user explicitly retry) from a structural one - bad number,
// missing template, bad credentials - that would just fail identically
// again (spec section 16: never blindly retry).
export type OutreachSendFailure = {
  success: false
  retryable: boolean
  errorCode: string
  errorMessage: string
  providerName: string
}

export type OutreachSendResult = OutreachSendSuccess | OutreachSendFailure

// The application's abstraction layer (spec section 3): business logic
// calls provider.send(...) and never touches Meta/Resend-specific
// request shapes directly. A provider implementation never throws for an
// expected "the message could not be sent" outcome - it returns
// OutreachSendFailure - so callers never need a try/catch around this
// call just to handle a normal rejection.
export interface OutreachProvider {
  readonly channel: "WHATSAPP" | "EMAIL"
  readonly providerName: string
  // Non-secret identifier of who the message is sent FROM (e.g. the
  // WhatsApp phone number ID, or the "from" email address) - distinct
  // from OutreachRecipient, which is always who it's sent TO. Snapshotted
  // onto outreach_send_attempts.sender_identity at send time so history
  // stays accurate even if the provider configuration changes later.
  readonly senderIdentity: string
  send(draft: Tables<"outreach_drafts">, recipient: OutreachRecipient): Promise<OutreachSendResult>
}
