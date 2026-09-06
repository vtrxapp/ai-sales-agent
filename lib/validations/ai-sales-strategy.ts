import * as z from "zod"

import { Constants } from "@/lib/types/database.types"

// Structured output for SalesStrategyService. Deliberately narrow: this
// schema only covers the narrative/reasoning fields that genuinely need
// language generation. Everything else a sales strategy needs -
// opportunity_id, target_contact_id, recommended_channel,
// recommended_service, priority - is selected by deterministic
// server-side logic (lib/services/opportunity-selection.ts,
// contact-selection.ts, channel-selection.ts) and never asked of the AI,
// so there is nothing for the AI to invent there.
export const SalesStrategyOutputSchema = z.object({
  primary_problem: z.string(),
  supporting_evidence: z.string(),
  evidence_type: z.enum(Constants.public.Enums.evidence_type),
  why_it_matters: z.string(),
  recommended_solution: z.string(),
  expected_business_benefit: z.string(),
  sales_angle: z.string(),
  value_proposition: z.string(),
  contact_reason: z.string(),
  opening_strategy: z.string(),
  objection_considerations: z.array(z.string()),
  things_to_avoid: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export type SalesStrategyOutput = z.infer<typeof SalesStrategyOutputSchema>
