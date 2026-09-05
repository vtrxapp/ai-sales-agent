import { test, expect } from "@playwright/test"

// This is an internal, invite-only tool: there is no public signup, so
// these tests cover what's verifiable without a real account. A fully
// authenticated flow (sign in -> see dashboard -> sign out) is covered in
// auth.authenticated.spec.ts, gated behind E2E_TEST_EMAIL/E2E_TEST_PASSWORD
// env vars for a test account you create yourself in the Supabase Dashboard
// - see README.md "Create your first user".

test.describe("unauthenticated access", () => {
  test("redirects the root path to /login", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login/)
  })

  test("redirects a protected route to /login", async ({ page }) => {
    await page.goto("/overview")
    await expect(page).toHaveURL(/\/login/)
  })

  test("redirects the campaigns route to /login", async ({ page }) => {
    await page.goto("/campaigns")
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe("login page", () => {
  test("shows the sign-in form by default", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByText("Zviko Growth Engine")).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible()
  })

  test("switches to the magic-link form", async ({ page }) => {
    await page.goto("/login")
    await page.getByText("Sign in with a magic link instead").click()
    await expect(page.getByLabel("Password")).not.toBeVisible()
    await expect(page.getByRole("button", { name: "Send magic link" })).toBeVisible()
  })

  test("rejects incorrect credentials with a real Supabase Auth error", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("no-such-user@example.com")
    await page.getByLabel("Password").fill("definitely-wrong-password")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page.getByText("Incorrect email or password.")).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})
