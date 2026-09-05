import { Send } from "lucide-react"

import { PhaseStub } from "@/components/dashboard/phase-stub"

export default function OutreachPage() {
  return (
    <PhaseStub
      title="Outreach"
      icon={Send}
      phase={4}
      description="Drafts, pending approval, sent, replies, and follow-ups arrive with Sales Intelligence (Phase 4). Every send requires human approval - the Draft -> Review -> Approve -> Execute workflow from the spec."
    />
  )
}
