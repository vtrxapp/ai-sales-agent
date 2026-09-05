import type { AIProvider } from "@/lib/ai/types"
import { DiscoveryOutputSchema, type DiscoveredBusinessCandidate } from "@/lib/validations/ai-discovery"
import type { DiscoveryCriteria, LeadDiscoveryProvider } from "@/lib/services/discovery/types"

const DISCOVERY_SYSTEM_PROMPT = `You are the Lead Discovery service for Zviko Labs, a digital product studio based in Harare, Zimbabwe. Find real, distinct, publicly-verifiable businesses matching the given criteria using web search and web fetch.

Rules:
- Only return real businesses you found actual public evidence for (a website, a directory listing, a social media page, a review site, a news mention). Never invent a business or its details.
- Do not return the same business twice.
- If you cannot find as many businesses as requested, return fewer - never pad the list with invented or low-confidence guesses.
- For each business, include a source_url pointing to where you found it, if you have one.
- Quality over quantity: prefer businesses that plausibly have a real reason to need Zviko Labs' services (websites, apps, booking systems, e-commerce, automation) over a large but irrelevant list.`

function buildDiscoveryPrompt(criteria: DiscoveryCriteria): string {
  const lines = [`Find up to ${criteria.count} real businesses matching this brief:`]
  if (criteria.industry) lines.push(`Industry: ${criteria.industry}`)
  if (criteria.businessType) lines.push(`Business type: ${criteria.businessType}`)
  if (criteria.location) {
    lines.push(`Location: ${criteria.location}`)
  } else {
    lines.push(
      "No location specified - prioritize Harare first, then other Zimbabwean cities, then Zimbabwe generally, then Africa, then international."
    )
  }
  if (criteria.searchQuery) lines.push(`Additional context: ${criteria.searchQuery}`)
  if (criteria.websiteRequired) lines.push("Only include businesses that have a discoverable website.")
  if (criteria.contactRequired) {
    lines.push("Only include businesses with some discoverable contact method (phone, email, or contact form).")
  }
  return lines.join("\n")
}

export class AIWebResearchDiscoveryProvider implements LeadDiscoveryProvider {
  constructor(private readonly ai: AIProvider) {}

  async discover(criteria: DiscoveryCriteria): Promise<DiscoveredBusinessCandidate[]> {
    const searchBudget = Math.min(Math.max(criteria.count, 3), 10)

    const research = await this.ai.researchWithWebTools({
      system: DISCOVERY_SYSTEM_PROMPT,
      prompt: buildDiscoveryPrompt(criteria),
      maxSearches: searchBudget,
      maxFetches: searchBudget,
    })

    const structured = await this.ai.generateStructuredOutput(DiscoveryOutputSchema, {
      system:
        "Extract the list of distinct real businesses mentioned in the research notes below into the required schema. Do not add any business not actually present in the notes.",
      prompt: `Research notes:\n${research.summary}`,
    })

    return structured.candidates.slice(0, criteria.count)
  }
}
