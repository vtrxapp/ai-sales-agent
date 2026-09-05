import { BarChart3 } from "lucide-react"

import { PhaseStub } from "@/components/dashboard/phase-stub"

export default function AnalyticsPage() {
  return (
    <PhaseStub
      title="Analytics"
      icon={BarChart3}
      phase={7}
      description="Traffic, leads, signups, signatures, conversions, and channel/campaign performance arrive with Marketing Intelligence (Phase 7). Missing metrics will always show as not available rather than fabricated numbers."
    />
  )
}
