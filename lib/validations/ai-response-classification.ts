import * as z from "zod"

import { Constants } from "@/lib/types/database.types"

// Structured output for classifying an inbound reply. Deliberately
// narrow: the AI only labels what's actually in the message (intent,
// sentiment, urgency, sales stage) plus its own reasoning - it never
// decides what to do about it (see response-action-service.ts, a pure
// deterministic mapping) and never invents facts not present in the
// message/conversation it was given.
export const ResponseClassificationOutputSchema = z.object({
  intent: z.enum(Constants.public.Enums.response_intent),
  sentiment: z.enum(Constants.public.Enums.response_sentiment),
  urgency: z.enum(Constants.public.Enums.response_urgency),
  sales_stage: z.enum(Constants.public.Enums.response_sales_stage),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

export type ResponseClassificationOutput = z.infer<typeof ResponseClassificationOutputSchema>
