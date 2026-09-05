import { UserSearch } from "lucide-react"

import { PhaseStub } from "@/components/dashboard/phase-stub"

export default function LeadsPage() {
  return (
    <PhaseStub
      title="Leads"
      icon={UserSearch}
      phase={2}
      description="Lead discovery, the lead list, scoring, and status tracking arrive with the Zviko Labs Lead Engine (Phase 2) - manual and URL-driven business research first, with room to add a paid enrichment provider later."
    />
  )
}
