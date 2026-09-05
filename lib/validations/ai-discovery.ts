import * as z from "zod"

// Structured output for BusinessDiscoveryService. confidence lets the
// service and the reviewing user gauge how sure the AI is that this is a
// real, distinct, correctly-attributed business - not a guarantee.
export const DiscoveredBusinessCandidateSchema = z.object({
  name: z.string(),
  industry: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  source_url: z.string().optional(),
  confidence: z.number().min(0).max(1),
})

export const DiscoveryOutputSchema = z.object({
  candidates: z.array(DiscoveredBusinessCandidateSchema),
})

export type DiscoveredBusinessCandidate = z.infer<typeof DiscoveredBusinessCandidateSchema>
export type DiscoveryOutput = z.infer<typeof DiscoveryOutputSchema>
