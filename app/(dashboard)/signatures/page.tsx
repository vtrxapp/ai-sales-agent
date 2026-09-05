import { FileSignature } from "lucide-react"

import { PhaseStub } from "@/components/dashboard/phase-stub"

export default function SignaturesPage() {
  return (
    <PhaseStub
      title="Signatures"
      icon={FileSignature}
      phase={6}
      description="Signature campaigns, supporters, sign-up sources, and conversion statistics arrive with Signature & Signup Tracking (Phase 6) - real consent capture and attribution, never fabricated signatures."
    />
  )
}
