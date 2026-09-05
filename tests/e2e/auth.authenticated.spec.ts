import { test, expect } from "@playwright/test"

// Exercises the full authenticated flow against a real Supabase Auth user.
// Skipped unless you provide a test account's credentials - create one via
// Supabase Dashboard > Authentication > Users > Add user (see README.md),
// then run:
//   E2E_TEST_EMAIL=you@example.com E2E_TEST_PASSWORD=... npm run test:e2e
const email = process.env.E2E_TEST_EMAIL
const password = process.env.E2E_TEST_PASSWORD

test.describe("authenticated flow", () => {
  test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run this test.")

  test("signs in, sees the dashboard shell, and signs out", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(email!)
    await page.getByLabel("Password").fill(password!)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()

    await expect(page).toHaveURL(/\/overview/)
    await expect(page.getByText("Growth overview")).toBeVisible()
    await expect(page.getByRole("link", { name: "Products" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Campaigns" })).toBeVisible()

    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})
