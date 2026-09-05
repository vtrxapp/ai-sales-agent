import type { z } from "zod"

export type StructuredCallOptions = {
  system?: string
  prompt: string
}

export type WebResearchOptions = {
  system?: string
  prompt: string
  maxSearches?: number
  maxFetches?: number
}

export type WebResearchResult = {
  /** Free-text synthesis from the research turn. */
  summary: string
  /** Real URLs read from the tool_result blocks Anthropic returned - never
   *  the model's own transcription of a URL. */
  sourceUrls: string[]
}

// Swappable AI backend. Anthropic is the only concrete implementation
// today (lib/ai/anthropic-provider.ts); adding another provider means a
// new class implementing this interface, no call-site changes.
export interface AIProvider {
  readonly model: string
  generateStructuredOutput<T>(schema: z.ZodType<T>, options: StructuredCallOptions): Promise<T>
  researchWithWebTools(options: WebResearchOptions): Promise<WebResearchResult>
}
