import "server-only"

import type { Tables } from "@/lib/types/database.types"
import type { OutreachProvider, OutreachRecipient, OutreachSendResult } from "@/lib/outreach/types"
import { normalizePhoneForSending } from "@/lib/services/phone-normalization"

// Meta bumps this periodically; override via WHATSAPP_API_VERSION rather
// than editing code. Verified current as of this phase's research
// (September 2026), not assumed from training data.
export const DEFAULT_WHATSAPP_API_VERSION = "v21.0"

export type WhatsAppProviderConfig = {
  accessToken: string
  phoneNumberId: string
  templateName: string
  templateLanguage: string
  apiVersion?: string
}

type WhatsAppApiError = { message?: string; type?: string; code?: number; error_subcode?: number; fbtrace_id?: string }
type WhatsAppApiResponseBody = { error?: WhatsAppApiError; messages?: { id: string }[] }

// Codes confirmed against current Meta documentation/error references:
// bad/undeliverable number, missing template, outside-window rejection,
// and auth failures never succeed on retry - they need a human to fix
// the number, the template configuration, or the credentials.
export function classifyWhatsAppError(
  httpStatus: number,
  error: WhatsAppApiError | undefined
): { retryable: boolean; errorCode: string; errorMessage: string } {
  const errorCode = error?.code !== undefined ? String(error.code) : String(httpStatus)

  if (httpStatus === 429) {
    return { retryable: true, errorCode, errorMessage: "The WhatsApp provider is rate-limiting requests right now. Try again shortly." }
  }
  if (httpStatus >= 500) {
    return { retryable: true, errorCode, errorMessage: "The WhatsApp provider had a temporary problem. Try again shortly." }
  }
  if (errorCode === "131026") {
    return {
      retryable: false,
      errorCode,
      errorMessage:
        "The message could not be delivered - the recipient's number may not be on WhatsApp, or may have blocked messages from businesses. Check the number and contact record.",
    }
  }
  if (errorCode === "132001") {
    return {
      retryable: false,
      errorCode,
      errorMessage:
        "The configured WhatsApp message template does not exist or isn't approved yet. Check WHATSAPP_TEMPLATE_NAME in the provider configuration.",
    }
  }
  if (errorCode === "131047") {
    return {
      retryable: false,
      errorCode,
      errorMessage:
        "WhatsApp rejected this as a re-engagement message outside the allowed messaging window. This should not happen for template-based sends - check the template configuration.",
    }
  }
  if (errorCode === "190") {
    return {
      retryable: false,
      errorCode,
      errorMessage: "The WhatsApp provider rejected the configured access token. Check WHATSAPP_ACCESS_TOKEN.",
    }
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    return {
      retryable: false,
      errorCode,
      errorMessage:
        "The message could not be sent because the WhatsApp provider rejected the request. Check the recipient number and WhatsApp Business configuration.",
    }
  }
  return { retryable: true, errorCode, errorMessage: "Could not complete the WhatsApp send. This may be temporary." }
}

// Official WhatsApp Business Platform (Meta Cloud API) only - no
// WhatsApp Web automation, no browser control, no unofficial/reverse-
// engineered libraries, no session cookies.
//
// Cold/business-initiated outreach - the only use case this app has -
// requires a pre-approved message TEMPLATE outside the 24-hour customer
// service window (verified against current Meta documentation before
// writing this, not assumed from training data: a business cannot send
// free-form text to someone who has never messaged it first). So every
// send here is a template message, with the human-approved draft's exact
// body text passed as that template's single body parameter - this is
// what "the provider must receive that exact approved content" means in
// practice for WhatsApp specifically. Zviko Labs must create that
// template and get it approved in Meta Business Manager before any send
// can work; no code can do that step.
export class WhatsAppCloudApiProvider implements OutreachProvider {
  readonly channel = "WHATSAPP" as const
  readonly providerName = "whatsapp_cloud_api"
  readonly senderIdentity: string

  constructor(private readonly config: WhatsAppProviderConfig) {
    this.senderIdentity = config.phoneNumberId
  }

  async send(draft: Tables<"outreach_drafts">, recipient: OutreachRecipient): Promise<OutreachSendResult> {
    const phoneResult = normalizePhoneForSending(recipient.phone ?? "")
    if (!phoneResult.valid) {
      return {
        success: false,
        retryable: false,
        errorCode: "INVALID_RECIPIENT",
        errorMessage: phoneResult.reason,
        providerName: this.providerName,
      }
    }

    const apiVersion = this.config.apiVersion || DEFAULT_WHATSAPP_API_VERSION
    const url = `https://graph.facebook.com/${apiVersion}/${this.config.phoneNumberId}/messages`

    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phoneResult.whatsappFormat,
          type: "template",
          template: {
            name: this.config.templateName,
            language: { code: this.config.templateLanguage },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: draft.body }],
              },
            ],
          },
        }),
      })
    } catch {
      return {
        success: false,
        retryable: true,
        errorCode: "NETWORK_ERROR",
        errorMessage: "Could not reach the WhatsApp provider - this may be a temporary network issue.",
        providerName: this.providerName,
      }
    }

    let json: WhatsAppApiResponseBody | null = null
    try {
      json = await response.json()
    } catch {
      // Non-JSON response body - json stays null, handled by the checks below.
    }

    if (!response.ok) {
      const { retryable, errorCode, errorMessage } = classifyWhatsAppError(response.status, json?.error)
      return { success: false, retryable, errorCode, errorMessage, providerName: this.providerName }
    }

    const messageId = json?.messages?.[0]?.id
    if (!messageId) {
      return {
        success: false,
        retryable: true,
        errorCode: "NO_MESSAGE_ID",
        errorMessage: "The WhatsApp provider accepted the request but returned no message ID.",
        providerName: this.providerName,
      }
    }

    return { success: true, providerMessageId: messageId, providerName: this.providerName }
  }
}
