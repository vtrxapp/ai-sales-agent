import * as z from "zod"

import { Constants } from "@/lib/types/database.types"

// Structured output for response-draft-service.ts. Mirrors
// ai-outreach-draft.ts's WhatsApp/Email split exactly (a WhatsApp
// message has no subject, an email does) - the extra `rationale` field
// is the only difference: a short, user-facing explanation of why this
// reply was drafted (spec section 18), never the model's internal
// reasoning.
export const WhatsAppResponseVariantSchema = z.object({
  variant: z.enum(Constants.public.Enums.outreach_variant),
  body: z.string(),
  rationale: z.string(),
})

export const EmailResponseVariantSchema = z.object({
  variant: z.enum(Constants.public.Enums.outreach_variant),
  subject: z.string(),
  body: z.string(),
  rationale: z.string(),
})

// Up to 3 (Recommended/Direct/Conversational), not exactly 3 - same
// reasoning as the outreach-draft schema: a partial response shouldn't
// fail the whole call, and the service layer dedupes by variant tag.
export const WhatsAppResponseDraftOutputSchema = z.object({
  variants: z.array(WhatsAppResponseVariantSchema).min(1).max(3),
})

export const EmailResponseDraftOutputSchema = z.object({
  variants: z.array(EmailResponseVariantSchema).min(1).max(3),
})

export type WhatsAppResponseVariant = z.infer<typeof WhatsAppResponseVariantSchema>
export type EmailResponseVariant = z.infer<typeof EmailResponseVariantSchema>
export type WhatsAppResponseDraftOutput = z.infer<typeof WhatsAppResponseDraftOutputSchema>
export type EmailResponseDraftOutput = z.infer<typeof EmailResponseDraftOutputSchema>
