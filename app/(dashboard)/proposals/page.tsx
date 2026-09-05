import { FileText } from "lucide-react"

import { PhaseStub } from "@/components/dashboard/phase-stub"

export default function ProposalsPage() {
  return (
    <PhaseStub
      title="Proposals"
      icon={FileText}
      phase={4}
      description="Draft, sent, accepted, and rejected proposals arrive with Sales Intelligence (Phase 4), generated from a business's problem, opportunity, and recommended solution."
    />
  )
}
