import "server-only"

import type { Enums } from "@/lib/types/database.types"
import type { OutreachProvider } from "@/lib/outreach/types"
import { WhatsAppCloudApiProvider } from "@/lib/outreach/whatsapp-provider"
import { ResendEmailProvider } from "@/lib/outreach/email-provider"
import { WhatsAppNotConfiguredError, EmailNotConfiguredError, OutreachProviderError } from "@/lib/outreach/errors"

export type { OutreachProvider, OutreachRecipient, OutreachSendResult } from "@/lib/outreach/types"
export * from "@/lib/outreach/errors"

export type WhatsAppConfigStatus =
  | { configured: true; phoneNumberId: string; templateName: string; templateLanguage: string; apiVersion: string | null }
  | { configured: false; missingEnvVars: string[] }

// Reports configuration presence/absence only - the values shown here
// (phone number ID, template name/language) are identifiers, never
// secrets, so they're safe to surface on the provider status page (spec
// section 33). The access token itself is never included in this type.
export function getWhatsAppConfigStatus(): WhatsAppConfigStatus {
  const missingEnvVars: string[] = []
  if (!process.env.WHATSAPP_ACCESS_TOKEN) missingEnvVars.push("WHATSAPP_ACCESS_TOKEN")
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) missingEnvVars.push("WHATSAPP_PHONE_NUMBER_ID")
  if (!process.env.WHATSAPP_TEMPLATE_NAME) missingEnvVars.push("WHATSAPP_TEMPLATE_NAME")
  if (!process.env.WHATSAPP_TEMPLATE_LANGUAGE) missingEnvVars.push("WHATSAPP_TEMPLATE_LANGUAGE")

  if (missingEnvVars.length > 0) return { configured: false, missingEnvVars }

  return {
    configured: true,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID as string,
    templateName: process.env.WHATSAPP_TEMPLATE_NAME as string,
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE as string,
    apiVersion: process.env.WHATSAPP_API_VERSION || null,
  }
}

export type EmailConfigStatus =
  | { configured: true; fromEmail: string; fromName: string | null }
  | { configured: false; missingEnvVars: string[] }

export function getEmailConfigStatus(): EmailConfigStatus {
  const missingEnvVars: string[] = []
  if (!process.env.RESEND_API_KEY) missingEnvVars.push("RESEND_API_KEY")
  if (!process.env.RESEND_FROM_EMAIL) missingEnvVars.push("RESEND_FROM_EMAIL")

  if (missingEnvVars.length > 0) return { configured: false, missingEnvVars }

  return {
    configured: true,
    fromEmail: process.env.RESEND_FROM_EMAIL as string,
    fromName: process.env.RESEND_FROM_NAME || null,
  }
}

// Factories throw a typed *NotConfiguredError rather than returning a
// stub - callers (the send service, server actions) get a clear,
// distinguishable error to translate into the UI's configuration-error
// message instead of a confusing downstream failure (spec section 34).
export function getWhatsAppProvider(): OutreachProvider {
  const status = getWhatsAppConfigStatus()
  if (!status.configured) throw new WhatsAppNotConfiguredError()

  return new WhatsAppCloudApiProvider({
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN as string,
    phoneNumberId: status.phoneNumberId,
    templateName: status.templateName,
    templateLanguage: status.templateLanguage,
    apiVersion: status.apiVersion ?? undefined,
  })
}

export function getEmailProvider(): OutreachProvider {
  const status = getEmailConfigStatus()
  if (!status.configured) throw new EmailNotConfiguredError()

  return new ResendEmailProvider({
    apiKey: process.env.RESEND_API_KEY as string,
    fromEmail: status.fromEmail,
    fromName: status.fromName ?? undefined,
  })
}

// Single entry point the send service uses - it already knows the
// channel from the draft it loaded, so it never needs to pick a provider
// itself beyond this dispatch.
export function getOutreachProvider(channel: Enums<"outreach_channel">): OutreachProvider {
  if (channel === "WHATSAPP") return getWhatsAppProvider()
  if (channel === "EMAIL") return getEmailProvider()
  throw new OutreachProviderError(`No outreach provider exists for channel "${String(channel)}".`)
}
