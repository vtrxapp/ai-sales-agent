import { test, expect } from "@playwright/test"

// Phase 2 adds real pages behind the same auth gate as Phase 1. These
// cover what's verifiable without a real account (see auth.spec.ts) or a
// configured ANTHROPIC_API_KEY - the authenticated rendering of leads/
// prospects/pipeline data is not yet covered by an automated test for the
// same reason the Phase 1 authenticated flow isn't (see README.md).

test.describe("Phase 2 routes require authentication", () => {
  for (const path of ["/leads", "/prospects", "/pipeline", "/prospects/00000000-0000-0000-0000-000000000000"]) {
    test(`redirects ${path} to /login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    })
  }
})
