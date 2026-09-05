"use client"

import { useActionState } from "react"

import { createOpportunityAction } from "@/app/actions/businesses"
import { Constants } from "@/lib/types/database.types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export function AddOpportunityForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(createOpportunityAction, null)

  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">Add opportunity</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="business_id" value={businessId} />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opp-type">Type</Label>
            <Select id="opp-type" name="opportunity_type" defaultValue="" required>
              <option value="" disabled>
                Choose a type
              </option>
              {Constants.public.Enums.opportunity_type.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opp-title">Title</Label>
            <Input id="opp-title" name="title" required />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opp-problem">Problem</Label>
          <Textarea id="opp-problem" name="problem" placeholder="What problem exists?" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opp-solution">Proposed solution</Label>
          <Textarea id="opp-solution" name="proposed_solution" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opp-priority">Priority</Label>
          <Select id="opp-priority" name="priority" defaultValue="MEDIUM">
            {Constants.public.Enums.opportunity_priority.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Adding..." : "Add opportunity"}
          </Button>
        </div>
      </form>
    </details>
  )
}
