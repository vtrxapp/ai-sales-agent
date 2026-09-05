import { describe, expect, it } from "vitest"

import { WebsiteAuditOutputSchema } from "./ai-website-audit"

const valid = {
  site_accessible: true,
  technical_score: 80,
  mobile_score: 70,
  ux_score: 75,
  accessibility_score: 60,
  seo_score: 65,
  content_score: 70,
  conversion_score: 55,
  functionality_score: 80,
  observed_issues: [
    { category: "SEO", issue: "No meta description", evidence: "Viewed page source", source_url: "https://example.com" },
  ],
  inferred_issues: [{ category: "CONTENT", issue: "Content may be stale", basis: "Copyright year is 3 years old" }],
  strengths: [{ category: "TECHNICAL", strength: "Fast load time", evidence: "Page loaded in under 1s" }],
  recommendations: [
    { category: "CONVERSION", recommendation: "Add a clear call to action", rationale: "No visible CTA on homepage" },
  ],
  confidence: 0.75,
}

describe("WebsiteAuditOutputSchema", () => {
  it("accepts a valid audit", () => {
    expect(WebsiteAuditOutputSchema.safeParse(valid).success).toBe(true)
  })

  it("accepts site_accessible: false with access_notes", () => {
    const result = WebsiteAuditOutputSchema.safeParse({
      ...valid,
      site_accessible: false,
      access_notes: "Site returned a 500 error.",
    })
    expect(result.success).toBe(true)
  })

  it("rejects a category score above 100", () => {
    const result = WebsiteAuditOutputSchema.safeParse({ ...valid, technical_score: 101 })
    expect(result.success).toBe(false)
  })

  it("rejects a negative category score", () => {
    const result = WebsiteAuditOutputSchema.safeParse({ ...valid, seo_score: -1 })
    expect(result.success).toBe(false)
  })

  it("rejects an invalid audit_category on an observed issue", () => {
    const result = WebsiteAuditOutputSchema.safeParse({
      ...valid,
      observed_issues: [{ category: "NOT_A_CATEGORY", issue: "x", evidence: "x" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects confidence outside 0-1", () => {
    const result = WebsiteAuditOutputSchema.safeParse({ ...valid, confidence: 1.2 })
    expect(result.success).toBe(false)
  })

  it("rejects a missing required field (site_accessible)", () => {
    const withoutFlag: Record<string, unknown> = { ...valid }
    delete withoutFlag.site_accessible
    expect(WebsiteAuditOutputSchema.safeParse(withoutFlag).success).toBe(false)
  })
})
