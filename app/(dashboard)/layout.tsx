import { requireUser } from "@/lib/dal"
import { Sidebar } from "@/components/shell/sidebar"
import { Topbar } from "@/components/shell/topbar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // proxy.ts already redirects unauthenticated requests; this is the real
  // per-request check, close to the data, per the Next.js auth guide's DAL pattern.
  const user = await requireUser()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={user.email ?? "Unknown user"} />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">{children}</main>
      </div>
    </div>
  )
}
