"use client"

import { useActionState } from "react"

import { updateOpportunityStatusAction } from "@/app/actions/businesses"
import { Constants, type Enums } from "@/lib/types/database.types"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

export function OpportunityStatusControl({
  businessId,
  opportunityId,
  currentStatus,
}: {
  businessId: string
  opportunityId: string
  currentStatus: Enums<"opportunity_status">
}) {
  const [state, action, pending] = useActionState(updateOpportunityStatusAction, null)

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <Select name="status" defaultValue={currentStatus} className="h-8 w-36 text-xs">
        {Constants.public.Enums.opportunity_status.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Updating..." : "Update"}
      </Button>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  )
}
