import { Users } from "lucide-react"

import { PhaseStub } from "@/components/dashboard/phase-stub"

export default function AudiencesPage() {
  return (
    <PhaseStub
      title="Audiences"
      icon={Users}
      phase={5}
      description="Audience discovery, segments, communities, influencers, and partnerships for the Dating App arrive with Phase 5. Every audience found is legitimate and publicly reachable - no private-community access or unsolicited outreach."
    />
  )
}
