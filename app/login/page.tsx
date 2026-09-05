import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Zviko Growth Engine</CardTitle>
          <CardDescription>
            Internal access only. Contact your administrator if you need an account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}
          <LoginForm next={next && next.startsWith("/") ? next : "/overview"} />
        </CardContent>
      </Card>
    </div>
  )
}
