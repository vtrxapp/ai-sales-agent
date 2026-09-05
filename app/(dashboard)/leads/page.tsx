import { LeadsWorkspace } from "@/components/leads/leads-workspace"
import { QuickAddForm } from "@/components/leads/quick-add-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// AI web search can involve several tool round-trips - give it more room
// than the default serverless timeout.
export const maxDuration = 60

export default function LeadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Find leads</h1>
        <p className="text-sm text-muted-foreground">
          Discover organizations that may need Zviko Labs&apos; services. Quality over quantity -
          a smaller list of genuinely relevant prospects beats a large irrelevant one.
        </p>
      </div>

      <LeadsWorkspace />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a specific business</CardTitle>
        </CardHeader>
        <CardContent>
          <QuickAddForm />
        </CardContent>
      </Card>
    </div>
  )
}
