"use client"

import { useActionState } from "react"

import { generateOutreachAction, regenerateOutreachAction } from "@/app/actions/outreach"
import { Button } from "@/components/ui/button"

export function GenerateOutreachAction({ businessId, hasExisting }: { businessId: string; hasExisting: boolean }) {
  const [genState, genAction, genPending] = useActionState(generateOutreachAction, null)
  const [regenState, regenAction, regenPending] = useActionState(regenerateOutreachAction, null)
  const anyPending = genPending || regenPending

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={genAction}>
          <input type="hidden" name="business_id" value={businessId} />
          <Button type="submit" size="sm" disabled={anyPending}>
            {genPending ? "Generating..." : "Generate Outreach"}
          </Button>
        </form>
        {hasExisting && (
          <form action={regenAction}>
            <input type="hidden" name="business_id" value={businessId} />
            <Button type="submit" size="sm" variant="outline" disabled={anyPending}>
              {regenPending ? "Regenerating..." : "Regenerate"}
            </Button>
          </form>
        )}
      </div>
      {genState?.error && <p className="text-sm text-destructive">{genState.error}</p>}
      {genState?.success && <p className="text-sm text-muted-foreground">{genState.success}</p>}
      {regenState?.error && <p className="text-sm text-destructive">{regenState.error}</p>}
      {regenState?.success && <p className="text-sm text-muted-foreground">{regenState.success}</p>}
    </div>
  )
}
