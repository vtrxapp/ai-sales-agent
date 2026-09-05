"use client"

import { useActionState } from "react"

import { updateStatusAction } from "@/app/actions/businesses"
import { Constants, type Enums } from "@/lib/types/database.types"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

export function StatusControl({
  businessId,
  currentStatus,
}: {
  businessId: string
  currentStatus: Enums<"pipeline_status">
}) {
  const [state, action, pending] = useActionState(updateStatusAction, null)

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="business_id" value={businessId} />
      <Select name="status" defaultValue={currentStatus} className="h-8 w-40 text-xs">
        {Constants.public.Enums.pipeline_status.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Updating..." : "Update"}
      </Button>
      {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  )
}
