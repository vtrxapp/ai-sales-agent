import type { DiscoveredBusinessCandidate } from "@/lib/validations/ai-discovery"
import type { DiscoveryCriteria, LeadDiscoveryProvider } from "@/lib/services/discovery/types"

// Post-filters applied after the provider returns candidates - kept here
// (not trusted to the AI prompt alone) so "website required" / "contact
// required" are reliably enforced regardless of provider.
export async function discoverBusinesses(
  provider: LeadDiscoveryProvider,
  criteria: DiscoveryCriteria
): Promise<DiscoveredBusinessCandidate[]> {
  const candidates = await provider.discover(criteria)

  return candidates.filter((candidate) => {
    if (criteria.websiteRequired && !candidate.website) return false
    if (criteria.contactRequired && !candidate.phone && !candidate.email) return false
    return true
  })
}
