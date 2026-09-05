"use client"

import { useActionState } from "react"

import { createManualBusinessAction } from "@/app/actions/businesses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function QuickAddForm() {
  const [state, action, pending] = useActionState(createManualBusinessAction, null)

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Already know a business you want to track? Add it directly by name and URL - you can run
        AI research on it afterward from its prospect page.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quick-name">Business name</Label>
          <Input id="quick-name" name="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quick-website">Website URL</Label>
          <Input id="quick-website" name="website" type="url" placeholder="https://" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Adding..." : "Add business"}
        </Button>
      </div>
    </form>
  )
}
