import "server-only"

import type { Tables } from "@/lib/types/database.types"
import type { OutreachProvider, OutreachRecipient, OutreachSendResult } from "@/lib/outreach/types"

export type ResendProviderConfig = {
  apiKey: string
  fromEmail: string
  fromName?: string
}

type ResendErrorBody = { name?: string; message?: string }

export function classifyResendError(
  httpStatus: number,
  body: ResendErrorBody | null
): { retryable: boolean; errorCode: string; errorMessage: string } {
  const errorCode = body?.name ?? String(httpStatus)

  if (httpStatus === 429) {
    return { retryable: true, errorCode, errorMessage: "The email provider is rate-limiting requests right now. Try again shortly." }
  }
  if (httpStatus >= 500) {
    return { retryable: true, errorCode, errorMessage: "The email provider had a temporary problem. Try again shortly." }
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      retryable: false,
      errorCode,
      errorMessage: "The email provider rejected the configured API key or sending domain. Check RESEND_API_KEY and RESEND_FROM_EMAIL.",
    }
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    return {
      retryable: false,
      errorCode,
      errorMessage:
        "The message could not be sent because the email provider rejected the request. Check the recipient address and sending domain configuration.",
    }
  }
  return { retryable: true, errorCode, errorMessage: "Could not complete the email send. This may be temporary." }
}

// One concrete transactional-email implementation behind the generic
// OutreachProvider abstraction (spec section 8 names Resend/SendGrid/SES
// as interchangeable options - Resend was chosen for its simple REST
// API; swapping providers means a new class implementing this same
// interface, no call-site changes).
export class ResendEmailProvider implements OutreachProvider {
  readonly channel = "EMAIL" as const
  readonly providerName = "resend"
  readonly senderIdentity: string

  constructor(private readonly config: ResendProviderConfig) {
    this.senderIdentity = config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail
  }

  async send(draft: Tables<"outreach_drafts">, recipient: OutreachRecipient): Promise<OutreachSendResult> {
    if (!recipient.email) {
      return {
        success: false,
        retryable: false,
        errorCode: "INVALID_RECIPIENT",
        errorMessage: "This contact has no email address on file.",
        providerName: this.providerName,
      }
    }
    if (!draft.subject || draft.subject.trim().length === 0) {
      return {
        success: false,
        retryable: false,
        errorCode: "MISSING_SUBJECT",
        errorMessage: "This draft has no subject line.",
        providerName: this.providerName,
      }
    }

    let response: Response
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.config.fromName ? `${this.config.fromName} <${this.config.fromEmail}>` : this.config.fromEmail,
          to: recipient.email,
          subject: draft.subject,
          text: draft.body,
        }),
      })
    } catch {
      return {
        success: false,
        retryable: true,
        errorCode: "NETWORK_ERROR",
        errorMessage: "Could not reach the email provider - this may be a temporary network issue.",
        providerName: this.providerName,
      }
    }

    let json: (ResendErrorBody & { id?: string }) | null = null
    try {
      json = await response.json()
    } catch {
      // Non-JSON response body - json stays null, handled by the checks below.
    }

    if (!response.ok) {
      const { retryable, errorCode, errorMessage } = classifyResendError(response.status, json)
      return { success: false, retryable, errorCode, errorMessage, providerName: this.providerName }
    }

    if (!json?.id) {
      return {
        success: false,
        retryable: true,
        errorCode: "NO_MESSAGE_ID",
        errorMessage: "The email provider accepted the request but returned no message ID.",
        providerName: this.providerName,
      }
    }

    return { success: true, providerMessageId: json.id, providerName: this.providerName }
  }
}
