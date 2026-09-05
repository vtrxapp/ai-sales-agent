"use client"

import { useActionState } from "react"

import { researchBusinessAction, scoreBusinessAction, auditWebsiteAction } from "@/app/actions/businesses"
import { Button } from "@/components/ui/button"

export function ResearchScoreActions({ businessId }: { businessId: string }) {
  const [researchState, researchAction, researchPending] = useActionState(researchBusinessAction, null)
  const [scoreState, scoreAction, scorePending] = useActionState(scoreBusinessAction, null)
  const [auditState, auditAction, auditPending] = useActionState(auditWebsiteAction, null)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <form action={researchAction}>
          <input type="hidden" name="business_id" value={businessId} />
          <Button type="submit" size="sm" variant="outline" disabled={researchPending}>
            {researchPending ? "Researching..." : "Research"}
          </Button>
        </form>
        <form action={scoreAction}>
          <input type="hidden" name="business_id" value={businessId} />
          <Button type="submit" size="sm" variant="outline" disabled={scorePending}>
            {scorePending ? "Scoring..." : "Score"}
          </Button>
        </form>
        <form action={auditAction}>
          <input type="hidden" name="business_id" value={businessId} />
          <Button type="submit" size="sm" variant="outline" disabled={auditPending}>
            {auditPending ? "Auditing website..." : "Audit Website"}
          </Button>
        </form>
      </div>
      {researchState?.error && <p className="text-sm text-destructive">{researchState.error}</p>}
      {researchState?.success && <p className="text-sm text-success">{researchState.success}</p>}
      {scoreState?.error && <p className="text-sm text-destructive">{scoreState.error}</p>}
      {scoreState?.success && <p className="text-sm text-success">{scoreState.success}</p>}
      {auditState?.error && <p className="text-sm text-destructive">{auditState.error}</p>}
      {auditState?.success && <p className="text-sm text-success">{auditState.success}</p>}
    </div>
  )
}
