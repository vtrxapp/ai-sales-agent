import * as z from "zod"

import { Constants } from "@/lib/types/database.types"

// Structured output for OpportunityAnalysisService. Mirrors the
// AI-supplies-components/server-recomputes-total pattern already used for
// lead scoring (lib/validations/ai-lead-score.ts): component maxima match
// the spec's weighting exactly (25/20/15/15/10/15 = 100) and the service
// layer always recomputes the total and priority from these, never from
// anything the AI states about the aggregate.
export const OpportunityScoreComponentsSchema = z.object({
  business_impact_score: z.number().int().min(0).max(25),
  evidence_strength_score: z.number().int().min(0).max(20),
  customer_need_score: z.number().int().min(0).max(15),
  commercial_fit_score: z.number().int().min(0).max(15),
  urgency_score: z.number().int().min(0).max(10),
  feasibility_score: z.number().int().min(0).max(15),
  reasoning: z.object({
    business_impact: z.string(),
    evidence_strength: z.string(),
    customer_need: z.string(),
    commercial_fit: z.string(),
    urgency: z.string(),
    feasibility: z.string(),
  }),
})

// evidence is the concrete "why should we contact this business" fact
// (grounded in research/audit findings); recommended_service and
// expected_benefit answer "what should we offer" and "why would it be
// valuable" respectively - the three fields the spec requires the
// prospect page to surface, so they exist as distinct fields rather than
// buried in a single freeform description.
export const IdentifiedOpportunitySchema = z.object({
  opportunity_type: z.enum(Constants.public.Enums.opportunity_type),
  title: z.string(),
  description: z.string(),
  problem: z.string(),
  evidence: z.string(),
  proposed_solution: z.string(),
  recommended_service: z.string(),
  expected_benefit: z.string(),
  estimated_complexity: z.enum(Constants.public.Enums.opportunity_complexity),
  confidence: z.number().min(0).max(1),
  ...OpportunityScoreComponentsSchema.shape,
})

export const OpportunityAnalysisOutputSchema = z.object({
  opportunities: z.array(IdentifiedOpportunitySchema),
})

export type IdentifiedOpportunity = z.infer<typeof IdentifiedOpportunitySchema>
export type OpportunityAnalysisOutput = z.infer<typeof OpportunityAnalysisOutputSchema>
