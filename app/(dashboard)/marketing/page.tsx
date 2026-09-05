import { Radio } from "lucide-react"

import { PhaseStub } from "@/components/dashboard/phase-stub"

export default function MarketingPage() {
  return (
    <PhaseStub
      title="Marketing"
      icon={Radio}
      phase={7}
      description="Campaign, content, channel, and UTM/referral tracking intelligence arrives with Marketing Intelligence (Phase 7), once there is real campaign_events data to analyze."
    />
  )
}
