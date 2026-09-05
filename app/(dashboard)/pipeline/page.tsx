import { Kanban } from "lucide-react"

import { PhaseStub } from "@/components/dashboard/phase-stub"

export default function PipelinePage() {
  return (
    <PhaseStub
      title="Sales Pipeline"
      icon={Kanban}
      phase={4}
      description="The New -> Qualified -> Contacted -> Replied -> Meeting -> Proposal -> Won/Lost pipeline arrives with Sales Intelligence (Phase 4), alongside outreach, follow-ups, and proposals."
    />
  )
}
