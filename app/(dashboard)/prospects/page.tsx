import { Building2 } from "lucide-react"

import { PhaseStub } from "@/components/dashboard/phase-stub"

export default function ProspectsPage() {
  return (
    <PhaseStub
      title="Prospects"
      icon={Building2}
      phase={3}
      description="The prospect database, opportunity detail, and website audits arrive with the Website Audit & Opportunity Engine (Phase 3)."
    />
  )
}
