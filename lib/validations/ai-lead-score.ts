import * as z from "zod"

// Structured output for LeadScoringService. Component maxima match the
// spec's weighting exactly (20/20/20/15/10/10/5 = 100); the service layer
// recomputes total_score and classification from these components rather
// than trusting anything the AI states about the total, so the score is
// explainable by construction, never an arbitrary unexplained number.
export const LeadScoreOutputSchema = z.object({
  industry_fit_score: z.number().int().min(0).max(20),
  digital_problems_score: z.number().int().min(0).max(20),
  missing_functionality_score: z.number().int().min(0).max(20),
  business_potential_score: z.number().int().min(0).max(15),
  contactability_score: z.number().int().min(0).max(10),
  growth_potential_score: z.number().int().min(0).max(10),
  other_score: z.number().int().min(0).max(5),
  reasoning: z.object({
    industry_fit: z.string(),
    digital_problems: z.string(),
    missing_functionality: z.string(),
    business_potential: z.string(),
    contactability: z.string(),
    growth_potential: z.string(),
    other: z.string(),
  }),
  confidence: z.number().min(0).max(1),
})

export type LeadScoreOutput = z.infer<typeof LeadScoreOutputSchema>
