"use client"

import { useActionState } from "react"

import { createCampaignAction } from "@/app/actions/campaigns"
import { Constants } from "@/lib/types/database.types"
import type { Tables } from "@/lib/types/database.types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  CLIENT_ACQUISITION: "Client acquisition",
  USER_ACQUISITION: "User acquisition",
  SIGNATURE_COLLECTION: "Signature collection",
  BRAND_AWARENESS: "Brand awareness",
  CONTENT: "Content",
  PARTNERSHIP: "Partnership",
  REFERRAL: "Referral",
}

export function CampaignForm({
  products,
  defaultProductId,
}: {
  products: Tables<"products">[]
  defaultProductId?: string
}) {
  const [state, action, pending] = useActionState(createCampaignAction, null)

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product_id">Product</Label>
        <Select id="product_id" name="product_id" defaultValue={defaultProductId} required>
          <option value="" disabled>
            Choose a product
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </Select>
        {state?.fieldErrors?.product_id && (
          <p className="text-sm text-destructive">{state.fieldErrors.product_id}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Campaign name</Label>
        <Input id="name" name="name" placeholder="e.g. Harare Gyms Q1 Outreach" required />
        {state?.fieldErrors?.name && (
          <p className="text-sm text-destructive">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="campaign_type">Campaign type</Label>
        <Select id="campaign_type" name="campaign_type" defaultValue="" required>
          <option value="" disabled>
            Choose a type
          </option>
          {Constants.public.Enums.campaign_type.map((type) => (
            <option key={type} value={type}>
              {CAMPAIGN_TYPE_LABELS[type] ?? type}
            </option>
          ))}
        </Select>
        {state?.fieldErrors?.campaign_type && (
          <p className="text-sm text-destructive">{state.fieldErrors.campaign_type}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="objective">Objective</Label>
        <Textarea
          id="objective"
          name="objective"
          placeholder="e.g. Generate 1,000 verified registrations"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target_location">Target location</Label>
          <Input id="target_location" name="target_location" placeholder="e.g. Harare, Zimbabwe" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget">Budget (USD)</Label>
          <Input id="budget" name="budget" type="number" min="0" step="0.01" />
          {state?.fieldErrors?.budget && (
            <p className="text-sm text-destructive">{state.fieldErrors.budget}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="target_audience">Target audience</Label>
        <Textarea id="target_audience" name="target_audience" placeholder="e.g. Zimbabwean adults 18+ in Harare" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" name="start_date" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="end_date">End date</Label>
          <Input id="end_date" name="end_date" type="date" />
          {state?.fieldErrors?.end_date && (
            <p className="text-sm text-destructive">{state.fieldErrors.end_date}</p>
          )}
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create campaign"}
        </Button>
      </div>
    </form>
  )
}
