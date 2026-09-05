import { Sparkles } from "lucide-react"

import { PhaseStub } from "@/components/dashboard/phase-stub"

export default function AssistantPage() {
  return (
    <PhaseStub
      title="AI Assistant"
      icon={Sparkles}
      phase={8}
      description="A conversational interface grounded in real database data arrives with the AI Growth Advisor (Phase 8), once there is enough lead, campaign, and conversion data for it to reason about."
    />
  )
}
