"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import * as z from "zod"

import { createClient } from "@/lib/supabase/server"

export type AuthFormState = {
  error?: string
  message?: string
} | null

const credentialsSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string().min(1, { error: "Enter your password." }),
})

export async function signInWithPassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: "Incorrect email or password." }
  }

  const next = formData.get("next")
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/overview")
}

const emailSchema = z.email({ error: "Enter a valid email address." })

export async function signInWithMagicLink(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email." }
  }

  const originHeader = (await headers()).get("origin")
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${originHeader}/auth/callback` },
  })

  if (error) {
    return { error: "Could not send magic link. Try again shortly." }
  }

  return { message: "Check your email for a sign-in link." }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
