import "server-only"

import type { Tables } from "@/lib/types/database.types"
import type { OutreachProvider, OutreachRecipient, OutreachSendResult } from "@/lib/outreach/types"

// TEST-ONLY. These providers report a message as sent without ever
// contacting a real WhatsApp or email API - spec section 35 is explicit
// that a fake provider reporting successful sends "must never be used in
// production. Production must require a real configured provider." The
// application's provider factory (lib/outreach/index.ts) never imports
// this file and has no code path that can select these classes - only
// automated tests construct them directly. Every provider message ID
// they return is prefixed "MOCK_SENT_" so a mock result can never be
// mistaken for a real provider message ID (a real wamid.../Resend id
// never has this shape) if one ever leaked into a log or the database.
let mockSendCounter = 0

function nextMockProviderMessageId(prefix: string): string {
  mockSendCounter += 1
  return `${prefix}_MOCK_SENT_${Date.now()}_${mockSendCounter}`
}

export class MockWhatsAppProvider implements OutreachProvider {
  readonly channel = "WHATSAPP" as const
  readonly providerName = "mock_whatsapp"
  readonly senderIdentity = "mock_whatsapp_sender"

  async send(_draft: Tables<"outreach_drafts">, recipient: OutreachRecipient): Promise<OutreachSendResult> {
    if (!recipient.phone) {
      return {
        success: false,
        retryable: false,
        errorCode: "INVALID_RECIPIENT",
        errorMessage: "This contact has no phone number on file.",
        providerName: this.providerName,
      }
    }
    return { success: true, providerMessageId: nextMockProviderMessageId("wamid"), providerName: this.providerName }
  }
}

export class MockEmailProvider implements OutreachProvider {
  readonly channel = "EMAIL" as const
  readonly providerName = "mock_email"
  readonly senderIdentity = "mock_email_sender"

  async send(_draft: Tables<"outreach_drafts">, recipient: OutreachRecipient): Promise<OutreachSendResult> {
    if (!recipient.email) {
      return {
        success: false,
        retryable: false,
        errorCode: "INVALID_RECIPIENT",
        errorMessage: "This contact has no email address on file.",
        providerName: this.providerName,
      }
    }
    return { success: true, providerMessageId: nextMockProviderMessageId("email"), providerName: this.providerName }
  }
}

// For exercising the failure/retry paths in tests without depending on a
// real provider actually rejecting something.
export class MockFailingProvider implements OutreachProvider {
  readonly providerName = "mock_failing"
  readonly senderIdentity = "mock_failing_sender"

  constructor(
    readonly channel: "WHATSAPP" | "EMAIL",
    private readonly failure: { retryable: boolean; errorCode: string; errorMessage: string } = {
      retryable: true,
      errorCode: "MOCK_FAILURE",
      errorMessage: "Mock provider configured to fail.",
    }
  ) {}

  async send(): Promise<OutreachSendResult> {
    return { success: false, ...this.failure, providerName: this.providerName }
  }
}
