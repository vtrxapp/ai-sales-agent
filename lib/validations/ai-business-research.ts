import * as z from "zod"

import { Constants } from "@/lib/types/database.types"

// Structured output for the LeadResearchService AI call. The schema itself
// enforces the spec's observed/inferred/recommendation split - there is no
// single freeform "summary" field an inference could hide inside.
export const ObservationSchema = z.object({
  fact: z.string(),
  source_url: z.string().optional(),
})

export const InferenceSchema = z.object({
  inference: z.string(),
  basis: z.string(),
})

export const RecommendationSchema = z.object({
  recommendation: z.string(),
  rationale: z.string(),
})

export const DigitalPresenceSchema = z.object({
  has_website: z.boolean(),
  has_online_booking: z.boolean(),
  has_ecommerce: z.boolean(),
  has_customer_portal: z.boolean(),
  has_mobile_app: z.boolean(),
  has_online_forms: z.boolean(),
  social_platforms: z.array(z.string()),
  notes: z.string().optional(),
})

export const ProposedOpportunitySchema = z.object({
  opportunity_type: z.enum(Constants.public.Enums.opportunity_type),
  title: z.string(),
  description: z.string(),
  problem: z.string(),
  proposed_solution: z.string(),
  priority: z.enum(Constants.public.Enums.opportunity_priority),
  confidence: z.number().min(0).max(1),
})

export const BusinessResearchOutputSchema = z.object({
  observations: z.array(ObservationSchema),
  inferences: z.array(InferenceSchema),
  recommendations: z.array(RecommendationSchema),
  digital_presence: DigitalPresenceSchema,
  proposed_opportunities: z.array(ProposedOpportunitySchema),
  confidence: z.number().min(0).max(1),
})

export type BusinessResearchOutput = z.infer<typeof BusinessResearchOutputSchema>
