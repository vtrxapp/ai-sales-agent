import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import type { z } from "zod"

import type { AIProvider, StructuredCallOptions, WebResearchOptions, WebResearchResult } from "@/lib/ai/types"
import { AIError, AIInvalidOutputError, AINotConfiguredError, AIRateLimitError } from "@/lib/ai/errors"

// ALWAYS default to claude-opus-5 per house AI-integration guidance -
// callers can override via ANTHROPIC_MODEL for cost reasons, but that is
// an explicit human choice, not something this code decides on its own.
export const DEFAULT_MODEL = "claude-opus-5"

const MAX_TOKENS = 16000

export class AnthropicProvider implements AIProvider {
  readonly model: string
  private readonly client: Anthropic

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async generateStructuredOutput<T>(schema: z.ZodType<T>, options: StructuredCallOptions): Promise<T> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: options.system,
        messages: [{ role: "user", content: options.prompt }],
        output_config: { format: zodOutputFormat(schema) },
      })

      if (response.parsed_output === null || response.parsed_output === undefined) {
        throw new AIInvalidOutputError(
          `AI response did not match the expected schema (stop_reason: ${response.stop_reason}).`
        )
      }

      return response.parsed_output
    } catch (err) {
      throw mapAnthropicError(err)
    }
  }

  async researchWithWebTools(options: WebResearchOptions): Promise<WebResearchResult> {
    try {
      const runner = this.client.beta.messages.toolRunner({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: options.system,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: options.maxSearches ?? 4 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: options.maxFetches ?? 4 },
        ],
        messages: [{ role: "user", content: options.prompt }],
      })

      for await (const message of runner) {
        if (message.stop_reason === "pause_turn") {
          runner.pushMessages({ role: "assistant", content: message.content })
        }
      }

      const finalMessage = await runner.done()

      const summary = finalMessage.content
        .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
        .map((block) => block.text)
        .join("\n\n")

      return { summary, sourceUrls: extractSourceUrls(finalMessage.content) }
    } catch (err) {
      throw mapAnthropicError(err)
    }
  }
}

// Reads real URLs out of Anthropic's own server-tool execution record
// (not the model's freeform text), so a stored source_url is never a
// model hallucination. Defensive per-block: an unrecognized/changed
// content shape is skipped rather than thrown.
function extractSourceUrls(content: unknown[]): string[] {
  const urls = new Set<string>()

  for (const block of content) {
    try {
      const b = block as { type?: string; content?: unknown }

      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const result of b.content as Array<{ url?: unknown }>) {
          if (typeof result?.url === "string") urls.add(result.url)
        }
      }

      if (b.type === "web_fetch_tool_result") {
        const fetchContent = b.content as { url?: unknown; document?: { url?: unknown } } | undefined
        const url = fetchContent?.url ?? fetchContent?.document?.url
        if (typeof url === "string") urls.add(url)
      }
    } catch {
      // Unrecognized block shape - skip rather than fail the whole call.
    }
  }

  return Array.from(urls)
}

function mapAnthropicError(err: unknown): AIError {
  if (err instanceof AIError) return err
  if (err instanceof Anthropic.AuthenticationError) {
    return new AINotConfiguredError("The configured ANTHROPIC_API_KEY was rejected by Anthropic.")
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AIRateLimitError(undefined, err)
  }
  if (err instanceof Anthropic.APIError) {
    return new AIError(`Anthropic API error: ${err.message}`, err)
  }
  return new AIError(err instanceof Error ? err.message : "Unknown AI error", err)
}
