"use client"

import { useActionState } from "react"

import { discoverLeadsAction, saveLeadsAction } from "@/app/actions/leads"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function LeadsWorkspace() {
  const [discoverState, discoverAction, discoverPending] = useActionState(discoverLeadsAction, null)
  const [saveState, saveAction, savePending] = useActionState(saveLeadsAction, null)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find leads</CardTitle>
          <CardDescription>
            Powered by Claude&apos;s web search - not a paid business-data provider. Provide at
            least one of industry, location, business type, or a search query.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={discoverAction} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" name="industry" placeholder="e.g. Gyms" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" placeholder="e.g. Harare, Zimbabwe" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="business_type">Business type</Label>
                <Input id="business_type" name="business_type" placeholder="e.g. Boutique fitness studio" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="count">Number to find (max 20)</Label>
                <Input id="count" name="count" type="number" min={1} max={20} defaultValue={10} required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="search_query">Search query / additional criteria</Label>
              <Textarea
                id="search_query"
                name="search_query"
                placeholder="e.g. gyms that don't appear to have an online class booking system"
              />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="website_required" className="size-4" />
                Website required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="contact_required" className="size-4" />
                Contact information required
              </label>
            </div>
            {discoverState?.error && <p className="text-sm text-destructive">{discoverState.error}</p>}
            <div>
              <Button type="submit" disabled={discoverPending}>
                {discoverPending ? "Searching the web..." : "Find leads"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {discoverState?.candidates && discoverState.candidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {discoverState.candidates.length} business
              {discoverState.candidates.length === 1 ? "" : "es"} found - review before saving
            </CardTitle>
            <CardDescription>Nothing has been saved yet. Uncheck any that don&apos;t belong.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveAction} className="flex flex-col gap-4">
              <input type="hidden" name="candidates_json" value={JSON.stringify(discoverState.candidates)} />
              <ul className="flex flex-col divide-y divide-border">
                {discoverState.candidates.map((candidate, index) => (
                  <li key={index} className="flex items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      name="selected"
                      value={index}
                      defaultChecked
                      className="mt-1 size-4"
                      aria-label={`Save ${candidate.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{candidate.name}</p>
                        {candidate.confidence < 0.5 && <Badge variant="warning">Low confidence</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[candidate.industry, candidate.location].filter(Boolean).join(" - ") || "No industry/location found"}
                      </p>
                      {candidate.description && <p className="mt-1 text-sm">{candidate.description}</p>}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {candidate.website && <span>{candidate.website}</span>}
                        {candidate.phone && <span>{candidate.phone}</span>}
                        {candidate.email && <span>{candidate.email}</span>}
                        {candidate.source_url && (
                          <a
                            href={candidate.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Source
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {saveState?.error && <p className="text-sm text-destructive">{saveState.error}</p>}
              <div>
                <Button type="submit" disabled={savePending}>
                  {savePending ? "Saving..." : "Save selected"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
