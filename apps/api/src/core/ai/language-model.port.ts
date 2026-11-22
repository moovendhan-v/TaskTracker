/**
 * The one thing AI features know about a model (dependency inversion): send messages, get
 * text back. Providers are adapters behind this port, so switching provider or model is
 * configuration, never a code change in a feature.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateRequest {
  /** The model's id at its provider, e.g. "gemini-2.0-flash" or "@cf/meta/llama-3.1-8b-instruct". */
  model: string;
  messages: readonly ChatMessage[];
  /** Upper bound on the answer's length. */
  maxOutputTokens: number;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  /** Tokens counted by the provider; estimated when it doesn't say. */
  inputTokens: number;
  outputTokens: number;
}

export abstract class LanguageModel {
  abstract generate(request: GenerateRequest): Promise<GenerateResult>;
}

/** A provider failed or answered with something unusable; the message is safe to show. */
export class LanguageModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LanguageModelError';
  }
}

/** A rough token count (about four characters a token) for when a provider reports none. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
