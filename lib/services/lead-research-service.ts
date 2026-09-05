import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Tables } from "@/lib/types/database.types"
import type { AIProvider } from "@/lib/ai/types"
import { BusinessResearchOutputSchema } from "@/lib/validations/ai-business-research"
import { logActivity } from "@/lib/services/activity-service"
import { findMatchingOpportunity, normalizeOpportunityTitle } from "@/lib/services/opportunity-service"

const RESEARCH_SYSTEM_PROMPT = `You are the Lead Research service for Zviko Labs, a digital product studio based in Harare, Zimbabwe.

Research the given business using web search and web fetch. Only report what you actually find or can reasonably infer from public sources - never invent facts, contact details, or names. Distinguish clearly between:
- an observation: something directly found on a real page you consulted
- an inference: something reasonably inferred from evidence, with the evidence stated as its basis
- a recommendation: a potential Zviko Labs service, with a rationale grounded in what was found

Also assess digital presence (website, online booking, e-commerce, customer portal, mobile app, online forms, social platforms), and propose 0-5 realistic opportunities Zviko Labs could offer - each with a specific problem statement and proposed solution grounded in what was actually found, not a generic pitch.`

const EXTRACTION_SYSTEM_PROMPT = `Extract structured findings from the research notes below into the required schema. Only include claims actually supported by the notes - do not add anything not present in them.`

function buildResearchPrompt(business: Tables<"businesses">): string {
  return `Research this business as thoroughly as the public web allows:
Name: ${business.name}
Known website: ${business.website ?? "none provided - try to find one"}
Known location: ${business.location ?? business.city ?? business.country ?? "unknown"}
Industry: ${business.industry ?? "unknown"}

Use web search and web fetch to find its website, services, contact methods, social presence, and any visible digital functionality. Then summarize your findings in prose before the structured extraction step.`
}

export async function researchBusiness(
  supabase: SupabaseClient<Database>,
  ai: AIProvider,
  businessId: string,
  actorId: string
): Promise<Tables<"business_research_notes">> {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single()
  if (businessError) throw new Error(`Business not found: ${businessError.message}`)

  const research = await ai.researchWithWebTools({
    system: RESEARCH_SYSTEM_PROMPT,
    prompt: buildResearchPrompt(business),
  })

  const structured = await ai.generateStructuredOutput(BusinessResearchOutputSchema, {
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: `Research notes:\n${research.summary}\n\nSource URLs consulted: ${
      research.sourceUrls.join(", ") || "none recorded"
    }`,
  })

  const { data: noteRow, error: noteError } = await supabase
    .from("business_research_notes")
    .insert({
      business_id: businessId,
      observations: structured.observations,
      inferences: structured.inferences,
      recommendations: structured.recommendations,
      digital_presence: structured.digital_presence,
      source_urls: research.sourceUrls,
      confidence: structured.confidence,
      model: ai.model,
      researched_by: actorId,
    })
    .select()
    .single()
  if (noteError) throw new Error(`Failed to save research notes: ${noteError.message}`)

  const { error: updateError } = await supabase
    .from("businesses")
    .update({ last_researched_at: new Date().toISOString() })
    .eq("id", businessId)
  if (updateError) throw new Error(`Failed to update business: ${updateError.message}`)

  // Dedup against opportunities already on file - matches on (business_id,
  // opportunity_type, normalized title) only, update in place and bump
  // times_detected on a match, insert fresh otherwise, never delete
  // history. Closes the Phase 2 gap where a repeated research run
  // inserted a fresh duplicate opportunity every time (see Phase 2
  // report's known limitations).
  let newOpportunities = 0
  let reDetectedOpportunities = 0
  for (const opportunity of structured.proposed_opportunities) {
    const existing = await findMatchingOpportunity(
      supabase,
      businessId,
      opportunity.opportunity_type,
      opportunity.title
    )
    if (existing) {
      const timesDetected = existing.times_detected + 1
      const { error: updateOppError } = await supabase
        .from("opportunities")
        .update({
          title: opportunity.title,
          title_normalized: normalizeOpportunityTitle(opportunity.title),
          description: opportunity.description,
          problem: opportunity.problem,
          proposed_solution: opportunity.proposed_solution,
          confidence: opportunity.confidence,
          last_detected_at: new Date().toISOString(),
          times_detected: timesDetected,
        })
        .eq("id", existing.id)
      if (updateOppError) throw new Error(`Failed to update opportunity: ${updateOppError.message}`)
      reDetectedOpportunities++

      await logActivity(supabase, {
        entityType: "business",
        entityId: businessId,
        activityType: "OPPORTUNITY_RE_DETECTED",
        description: `Opportunity "${opportunity.title}" was detected again for "${business.name}" (now seen ${timesDetected} times).`,
        productId: null,
        actorId,
        metadata: { opportunity_id: existing.id, times_detected: timesDetected },
      })
    } else {
      const { error: insertOppError } = await supabase.from("opportunities").insert({
        business_id: businessId,
        opportunity_type: opportunity.opportunity_type,
        title: opportunity.title,
        title_normalized: normalizeOpportunityTitle(opportunity.title),
        description: opportunity.description,
        problem: opportunity.problem,
        proposed_solution: opportunity.proposed_solution,
        priority: opportunity.priority,
        confidence: opportunity.confidence,
        source: "ai_research",
        created_by: actorId,
      })
      if (insertOppError) throw new Error(`Failed to save proposed opportunity: ${insertOppError.message}`)
      newOpportunities++
    }
  }

  await logActivity(supabase, {
    entityType: "business",
    entityId: businessId,
    activityType: "BUSINESS_RESEARCHED",
    description: `"${business.name}" was researched (${structured.observations.length} observations, ${newOpportunities} new opportunities, ${reDetectedOpportunities} re-detected).`,
    productId: null,
    actorId,
    metadata: {
      source_urls: research.sourceUrls,
      new_opportunities: newOpportunities,
      re_detected_opportunities: reDetectedOpportunities,
    },
  })

  return noteRow
}
