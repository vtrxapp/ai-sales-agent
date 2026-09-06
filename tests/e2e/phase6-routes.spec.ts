import { test, expect } from "@playwright/test"

// Phase 6 adds /responses behind the same auth gate as every other
// dashboard route, and two webhook endpoints that must NOT be behind
// that gate (Meta/Resend call them directly with no Supabase session -
// see the PUBLIC_ROUTES comment in lib/supabase/middleware.ts).

test.describe("Phase 6 dashboard routes require authentication", () => {
  for (const path of ["/responses", "/responses/00000000-0000-0000-0000-000000000000"]) {
    test(`redirects ${path} to /login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    })
  }
})

test.describe("webhook endpoints bypass the Supabase auth gate", () => {
  test("GET /api/webhooks/whatsapp is reachable without a session and rejects a bad verify token rather than redirecting to /login", async ({
    request,
  }) => {
    const response = await request.get("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123", {
      maxRedirects: 0,
    })
    // Never a 3xx to /login - either 403 (verification rejected) or 503
    // (not configured in this environment) are both "reached the route
    // handler itself", which is what this test is actually checking.
    expect([403, 503]).toContain(response.status())
  })

  test("POST /api/webhooks/resend is reachable without a session and rejects an unsigned body rather than redirecting to /login", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/resend", {
      data: { type: "email.received", data: {} },
      maxRedirects: 0,
    })
    expect([401, 503]).toContain(response.status())
  })
})
