// Typed AI errors so callers (server actions, UI) can distinguish "not
// configured yet" from a transient failure from a genuine bug, and never
// have to guess from a string message.

export class AIError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "AIError"
  }
}

export class AINotConfiguredError extends AIError {
  constructor(message = "AI features are not configured. Set ANTHROPIC_API_KEY to enable them.") {
    super(message)
    this.name = "AINotConfiguredError"
  }
}

export class AIRateLimitError extends AIError {
  constructor(message = "The AI provider rate-limited this request. Try again shortly.", cause?: unknown) {
    super(message, cause)
    this.name = "AIRateLimitError"
  }
}

export class AIInvalidOutputError extends AIError {
  constructor(message = "The AI response did not match the expected structure.", cause?: unknown) {
    super(message, cause)
    this.name = "AIInvalidOutputError"
  }
}
