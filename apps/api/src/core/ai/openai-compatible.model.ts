import { estimateTokens, LanguageModel, LanguageModelError, type GenerateRequest, type GenerateResult } from './language-model.port.js';

export interface OpenAiCompatibleOptions {
  /** e.g. https://generativelanguage.googleapis.com/v1beta/openai (Gemini) or https://api.cloudflare.com/client/v4/accounts/<id>/ai/v1 (Workers AI). */
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

/** The longest answer we read back, whatever the provider sends. */
const ANSWER_MAX = 20_000;

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null);

/**
 * Any provider that speaks the OpenAI chat completions API: OpenAI, Gemini, Cloudflare Workers AI,
 * Groq, OpenRouter, Together, Ollama and more. One POST to {baseUrl}/chat/completions with a
 * timeout; the answer is treated as untrusted input and checked before use.
 */
export class OpenAiCompatibleModel extends LanguageModel {
  constructor(private readonly options: OpenAiCompatibleOptions) {
    super();
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.options.apiKey}` },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          max_tokens: request.maxOutputTokens,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw new LanguageModelError(error instanceof Error && error.name === 'TimeoutError' ? 'The AI provider took too long to answer' : 'The AI provider could not be reached');
    }
    if (!response.ok) {
      // The provider's own message can echo request details; only the status is passed on.
      throw new LanguageModelError(response.status === 429 ? 'The AI provider is busy; try again in a moment' : `The AI provider refused the request (${response.status})`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new LanguageModelError('The AI provider sent an unreadable answer');
    }
    const choice = record((Array.isArray(record(body)['choices']) ? (record(body)['choices'] as unknown[]) : [])[0]);
    const content = record(choice['message'])['content'];
    if (typeof content !== 'string' || !content.trim()) throw new LanguageModelError('The AI provider sent an empty answer');
    const text = content.slice(0, ANSWER_MAX);
    const usage = record(record(body)['usage']);
    return {
      text,
      inputTokens: count(usage['prompt_tokens']) ?? estimateTokens(request.messages.map((message) => message.content).join('\n')),
      outputTokens: count(usage['completion_tokens']) ?? estimateTokens(text),
    };
  }
}
