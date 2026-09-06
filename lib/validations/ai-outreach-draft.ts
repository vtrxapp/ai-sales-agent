import * as z from "zod"

import { Constants } from "@/lib/types/database.types"

// Structured output for OutreachDraftService. Two shapes because a
// WhatsApp message has no subject line and an email does - the channel
// picked by determineChannel() decides which schema is used, so there is
// never an ambiguous "subject" field on a WhatsApp draft.
export const WhatsAppVariantSchema = z.object({
  variant: z.enum(Constants.public.Enums.outreach_variant),
  body: z.string(),
})

export const EmailVariantSchema = z.object({
  variant: z.enum(Constants.public.Enums.outreach_variant),
  subject: z.string(),
  body: z.string(),
})

// Up to 3 (Recommended/Direct/Conversational) - not exactly 3, so a
// partial response from the model doesn't fail the whole call; the
// service layer dedupes by variant tag rather than assuming 3 distinct
// ones always come back.
export const WhatsAppDraftOutputSchema = z.object({
  variants: z.array(WhatsAppVariantSchema).min(1).max(3),
})

export const EmailDraftOutputSchema = z.object({
  variants: z.array(EmailVariantSchema).min(1).max(3),
})

export type WhatsAppVariant = z.infer<typeof WhatsAppVariantSchema>
export type EmailVariant = z.infer<typeof EmailVariantSchema>
export type WhatsAppDraftOutput = z.infer<typeof WhatsAppDraftOutputSchema>
export type EmailDraftOutput = z.infer<typeof EmailDraftOutputSchema>
