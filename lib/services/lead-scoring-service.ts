import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Enums, Tables } from "@/lib/types/database.types"
import type { AIProvider } from "@/lib/ai/types"
import { LeadScoreOutputSchema, type LeadScoreOutput } from "@/lib/validations/ai-lead-score"
import { logActivity } from "@/lib/services/activity-service"
import { getBusinessById, type BusinessDetail } from "@/lib/services/business-service"

// Pure - unit-testable without touching the AI or the database. The
// service never trusts an AI-reported total; it always recomputes this
// from the validated components, so the score is explainable by
// construction (spec: "do not produce an arbitrary AI score with no
// explanation").
export function computeTotalScore(components: LeadScoreOutput): number {
  return (
    components.industry_fit_score +
    components.digital_problems_score +
    components.missing_functionality_score +
    components.business_potential_score +
    components.contactability_score +
    components.growth_potential_score +
    components.other_score
  )
}

export function classifyScore(total: number): Enums<"lead_classification"> {
  if (total >= 90) return "EXCEPTIONAL"
  if (total >= 75) return "HIGH"
  if (total >= 60) return "MEDIUM"
  if (total >= 40) return "LOW"
  return "VERY_LOW"
}

const SCORING_SYSTEM_PROMPT = `You are the Lead Scoring service for Zviko Labs, a digital product studio based in Harare, Zimbabwe that builds websites, mobile/web apps, booking systems, e-commerce, and custom software.

Score the business strictly on the evidence provided - do not invent facts. If evidence for a component is thin, score conservatively and say so in the reasoning for that component. Every component score must have a one-to-two sentence reasoning explaining what evidence drove it.

Scoring components (weights are hard maxima - never exceed them):
- industry_fit_score (0-20): how well this business's industry/type fits Zviko Labs' target market (schools, gyms, restaurants, hotels, healthcare, churches, real estate, retail, professional services, SMEs, NGOs, tourism, construction, logistics, and similar organizations with digital transformation potential).
- digital_problems_score (0-20): how many meaningful, evidenced digital problems or opportunities are visible.
- missing_functionality_score (0-20): evidence of missing booking, e-commerce, customer portal, online forms, mobile app, automation, payments, or dashboards.
- business_potential_score (0-15): likely commercial value/deal size based on available evidence (size signals, multiple locations, industry norms) - do not invent a dollar figure, reason qualitatively.
- contactability_score (0-10): whether legitimate contact channels exist (phone, email, WhatsApp, working website contact form).
- growth_potential_score (0-10): whether improving digital presence could plausibly grow this specific business.
- other_score (0-5): any other relevant factor worth noting.`

function formatResearchContext(research: BusinessDetail["research_notes"][number] | null): string {
  if (!research) {
    return "No research has been recorded for this business yet. Score conservatively based only on the business record fields below."
  }

  const presence = research.digital_presence as Record<string, unknown>
  return `Most recent research (${research.researched_at}):
Digital presence: ${JSON.stringify(presence)}
Observations: ${JSON.stringify(research.observations)}
Inferences: ${JSON.stringify(research.inferences)}`
}

function buildScoringPrompt(business: BusinessDetail): string {
  const latestResearch = business.research_notes[0] ?? null
  return `Business record:
Name: ${business.name}
Industry: ${business.industry ?? "unknown"}
Location: ${business.location ?? "unknown"} (${business.city ?? "?"}, ${business.country ?? "?"})
Website: ${business.website ?? "none on record"}
Phone: ${business.phone ?? "none on record"}
WhatsApp status: ${business.whatsapp_status}
Email: ${business.email ?? "none on record"}
Description: ${business.description ?? "none on record"}

${formatResearchContext(latestResearch)}

Score this business now.`
}

export async function scoreLead(
  supabase: SupabaseClient<Database>,
  ai: AIProvider,
  businessId: string,
  actorId: string
): Promise<Tables<"lead_scores">> {
  const business = await getBusinessById(supabase, businessId)
  if (!business) throw new Error("Business not found.")

  const output = await ai.generateStructuredOutput(LeadScoreOutputSchema, {
    system: SCORING_SYSTEM_PROMPT,
    prompt: buildScoringPrompt(business),
  })

  const totalScore = computeTotalScore(output)
  const classification = classifyScore(totalScore)

  const { data: scoreRow, error } = await supabase
    .from("lead_scores")
    .upsert(
      {
        business_id: businessId,
        industry_fit_score: output.industry_fit_score,
        digital_problems_score: output.digital_problems_score,
        missing_functionality_score: output.missing_functionality_score,
        business_potential_score: output.business_potential_score,
        contactability_score: output.contactability_score,
        growth_potential_score: output.growth_potential_score,
        other_score: output.other_score,
        total_score: totalScore,
        classification,
        reasoning: output.reasoning,
        confidence: output.confidence,
        model: ai.model,
        scored_by: actorId,
        scored_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    )
    .select()
    .single()

  if (error) throw new Error(`Failed to save lead score: ${error.message}`)

  await logActivity(supabase, {
    entityType: "business",
    entityId: businessId,
    activityType: "LEAD_SCORED",
    description: `"${business.name}" scored ${totalScore}/100 (${classification}).`,
    productId: null,
    actorId,
    metadata: { total_score: totalScore, classification },
  })

  return scoreRow
}
