"use client"

import { useActionState } from "react"

import { createContactAction } from "@/app/actions/businesses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AddContactForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(createContactAction, null)

  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">Add contact</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="business_id" value={businessId} />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input id="contact-name" name="name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-title">Job title</Label>
            <Input id="contact-title" name="job_title" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input id="contact-email" name="email" type="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input id="contact-phone" name="phone" />
          </div>
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Adding..." : "Add contact"}
          </Button>
        </div>
      </form>
    </details>
  )
}
