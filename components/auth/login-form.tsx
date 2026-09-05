"use client"

import { useActionState, useState } from "react"

import { signInWithPassword, signInWithMagicLink } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "magic-link">("password")
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    null
  )
  const [magicLinkState, magicLinkAction, magicLinkPending] = useActionState(
    signInWithMagicLink,
    null
  )

  if (mode === "magic-link") {
    return (
      <form action={magicLinkAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@zviko.com" required />
        </div>
        {magicLinkState?.error && (
          <p className="text-sm text-destructive">{magicLinkState.error}</p>
        )}
        {magicLinkState?.message && (
          <p className="text-sm text-success">{magicLinkState.message}</p>
        )}
        <Button type="submit" disabled={magicLinkPending}>
          {magicLinkPending ? "Sending link..." : "Send magic link"}
        </Button>
        <button
          type="button"
          onClick={() => setMode("password")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Use password instead
        </button>
      </form>
    )
  }

  return (
    <form action={passwordAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="you@zviko.com" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {passwordState?.error && (
        <p className="text-sm text-destructive">{passwordState.error}</p>
      )}
      <Button type="submit" disabled={passwordPending}>
        {passwordPending ? "Signing in..." : "Sign in"}
      </Button>
      <button
        type="button"
        onClick={() => setMode("magic-link")}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Sign in with a magic link instead
      </button>
    </form>
  )
}
