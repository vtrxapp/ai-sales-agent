import { describe, expect, it } from "vitest"

import { summarizeCampaigns, summarizePipeline } from "./analytics-service"

describe("summarizeCampaigns", () => {
  it("returns all zeros for no campaigns", () => {
    const result = summarizeCampaigns([], 2)
    expect(result).toEqual({
      totalProducts: 2,
      totalCampaigns: 0,
      activeCampaigns: 0,
      campaignsByProduct: {},
    })
  })

  it("counts campaigns per product and active status", () => {
    const result = summarizeCampaigns(
      [
        { product_id: "a", status: "ACTIVE" },
        { product_id: "a", status: "DRAFT" },
        { product_id: "b", status: "ACTIVE" },
        { product_id: "b", status: "ARCHIVED" },
      ],
      2
    )

    expect(result.totalCampaigns).toBe(4)
    expect(result.activeCampaigns).toBe(2)
    expect(result.campaignsByProduct).toEqual({ a: 2, b: 2 })
  })

  it("does not count paused/completed/archived as active", () => {
    const result = summarizeCampaigns(
      [
        { product_id: "a", status: "PAUSED" },
        { product_id: "a", status: "COMPLETED" },
        { product_id: "a", status: "ARCHIVED" },
      ],
      1
    )

    expect(result.activeCampaigns).toBe(0)
  })
})

describe("summarizePipeline", () => {
  it("counts businesses per pipeline status", () => {
    const result = summarizePipeline([
      { pipeline_status: "NEW", classification: null },
      { pipeline_status: "NEW", classification: null },
      { pipeline_status: "WON", classification: "HIGH" },
    ])

    expect(result.totalProspects).toBe(3)
    expect(result.statusCounts.NEW).toBe(2)
    expect(result.statusCounts.WON).toBe(1)
    expect(result.statusCounts.LOST).toBe(0)
  })

  it("counts only businesses with a lead score as scored", () => {
    const result = summarizePipeline([
      { pipeline_status: "NEW", classification: "HIGH" },
      { pipeline_status: "NEW", classification: null },
    ])

    expect(result.scoredCount).toBe(1)
  })

  it("flags high-value prospects still in NEW status as uncontacted", () => {
    const result = summarizePipeline([
      { pipeline_status: "NEW", classification: "EXCEPTIONAL" },
      { pipeline_status: "NEW", classification: "HIGH" },
      { pipeline_status: "NEW", classification: "MEDIUM" },
      { pipeline_status: "CONTACTED", classification: "HIGH" },
    ])

    expect(result.highValueUncontactedCount).toBe(2)
  })
})
