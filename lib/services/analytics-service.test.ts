import { describe, expect, it } from "vitest"

import { summarizeCampaigns, summarizePipeline, summarizeSendAttempts } from "./analytics-service"

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

describe("summarizeSendAttempts", () => {
  it("returns null success rate and all-zero counts with no attempts", () => {
    const result = summarizeSendAttempts([], new Map())
    expect(result).toEqual({
      messagesSentByChannel: { WHATSAPP: 0, EMAIL: 0 },
      sendFailures: 0,
      sendSuccessRate: null,
      sentByIndustry: {},
    })
  })

  it("counts sent messages by channel and failures separately, ignoring PENDING", () => {
    const result = summarizeSendAttempts(
      [
        { status: "SENT", channel: "WHATSAPP", business_id: "biz-1" },
        { status: "SENT", channel: "WHATSAPP", business_id: "biz-1" },
        { status: "SENT", channel: "EMAIL", business_id: "biz-2" },
        { status: "FAILED", channel: "WHATSAPP", business_id: "biz-1" },
        { status: "PENDING", channel: "EMAIL", business_id: "biz-2" },
      ],
      new Map()
    )

    expect(result.messagesSentByChannel).toEqual({ WHATSAPP: 2, EMAIL: 1 })
    expect(result.sendFailures).toBe(1)
    // 3 sent / 4 completed (sent+failed) - the PENDING row doesn't count as completed.
    expect(result.sendSuccessRate).toBe(75)
  })

  it("groups sent messages by industry, falling back to Unknown when not on file", () => {
    const result = summarizeSendAttempts(
      [
        { status: "SENT", channel: "WHATSAPP", business_id: "biz-1" },
        { status: "SENT", channel: "EMAIL", business_id: "biz-2" },
        { status: "SENT", channel: "WHATSAPP", business_id: "biz-3" },
      ],
      new Map([
        ["biz-1", "Fitness"],
        ["biz-2", "Fitness"],
        ["biz-3", null],
      ])
    )

    expect(result.sentByIndustry).toEqual({ Fitness: 2, Unknown: 1 })
  })
})
