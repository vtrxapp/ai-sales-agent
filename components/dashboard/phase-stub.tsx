import type { LucideIcon } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"

export function PhaseStub({
  title,
  icon,
  phase,
  description,
}: {
  title: string
  icon: LucideIcon
  phase: number
  description: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <EmptyState
        icon={icon}
        title={`Coming in Phase ${phase}`}
        description={description}
      />
    </div>
  )
}
