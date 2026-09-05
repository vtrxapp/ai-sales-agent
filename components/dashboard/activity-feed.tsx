import { History } from "lucide-react"

import type { Tables } from "@/lib/types/database.types"
import { EmptyState } from "@/components/dashboard/empty-state"

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ActivityFeed({ activities }: { activities: Tables<"activities">[] }) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Actions like creating a campaign will show up here as they happen."
      />
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {activities.map((activity) => (
        <li key={activity.id} className="flex items-start justify-between gap-4 py-3">
          <p className="text-sm">{activity.description}</p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo(activity.created_at)}
          </span>
        </li>
      ))}
    </ul>
  )
}
