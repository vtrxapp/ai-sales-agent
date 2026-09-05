import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Boxes,
  Megaphone,
  UserSearch,
  Building2,
  Kanban,
  Users,
  Radio,
  FileSignature,
  BarChart3,
  Send,
  FileText,
  Sparkles,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** Phase this section becomes functional in, per PROJECT_AUDIT.md. Omitted once live. */
  comingInPhase?: number
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Products", href: "/products", icon: Boxes },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Leads", href: "/leads", icon: UserSearch, comingInPhase: 2 },
  { label: "Prospects", href: "/prospects", icon: Building2, comingInPhase: 3 },
  { label: "Sales Pipeline", href: "/pipeline", icon: Kanban, comingInPhase: 4 },
  { label: "Audiences", href: "/audiences", icon: Users, comingInPhase: 5 },
  { label: "Marketing", href: "/marketing", icon: Radio, comingInPhase: 7 },
  { label: "Signatures", href: "/signatures", icon: FileSignature, comingInPhase: 6 },
  { label: "Analytics", href: "/analytics", icon: BarChart3, comingInPhase: 7 },
  { label: "Outreach", href: "/outreach", icon: Send, comingInPhase: 4 },
  { label: "Proposals", href: "/proposals", icon: FileText, comingInPhase: 4 },
  { label: "AI Assistant", href: "/assistant", icon: Sparkles, comingInPhase: 8 },
]
