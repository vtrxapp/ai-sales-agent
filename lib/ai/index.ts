import "server-only"

import type { AIProvider } from "@/lib/ai/types"
import { AnthropicProvider, DEFAULT_MODEL } from "@/lib/ai/anthropic-provider"
import { AINotConfiguredError } from "@/lib/ai/errors"

export type { AIProvider } from "@/lib/ai/types"
export * from "@/lib/ai/errors"

// Factory for the configured AI provider. Throws AINotConfiguredError
// (never silently returns a stub) when ANTHROPIC_API_KEY is unset, so
// callers get a clear, typed error to surface in the UI.
export function getAIProvider(): AIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AINotConfiguredError(
      "AI-powered features (research, scoring, lead discovery) require ANTHROPIC_API_KEY to be set. See .env.example."
    )
  }
  return new AnthropicProvider(apiKey, process.env.ANTHROPIC_MODEL || DEFAULT_MODEL)
}
