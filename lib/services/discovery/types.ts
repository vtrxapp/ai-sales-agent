import type { DiscoveredBusinessCandidate } from "@/lib/validations/ai-discovery"

export type DiscoveryCriteria = {
  industry?: string
  location?: string
  businessType?: string
  searchQuery?: string
  count: number
  websiteRequired?: boolean
  contactRequired?: boolean
}

// Swappable discovery backend. AIWebResearchDiscoveryProvider (Claude web
// search/fetch) is the only implementation today - a future paid provider
// (Google Places, Apollo, Clearbit, ...) implements the same interface
// without touching BusinessDiscoveryService or the /leads page.
export interface LeadDiscoveryProvider {
  discover(criteria: DiscoveryCriteria): Promise<DiscoveredBusinessCandidate[]>
}
