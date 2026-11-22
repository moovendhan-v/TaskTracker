import { estimateTokens, LanguageModel, type GenerateRequest, type GenerateResult } from './language-model.port.js';

/**
 * A model for tests and local development without a key: answers deterministically from the
 * request, so tests can check what was asked without calling (or paying) anyone. Only
 * allowed when NODE_ENV=test or development.
 */
export class FakeModel extends LanguageModel {
  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const system = request.messages.find((message) => message.role === 'system')?.content ?? '';
    const user = request.messages.filter((message) => message.role === 'user').map((message) => message.content).join('\n');
    const task = /^TASK: ([a-z_]+)/m.exec(system)?.[1] ?? 'answer';
    const lines = user.split('\n').filter((line) => line.trim());
    const text = `[fake ${request.model} ${task}] ${lines.length} lines; first: ${(lines[0] ?? '').slice(0, 120)}`;
    return { text, inputTokens: estimateTokens(system + user), outputTokens: estimateTokens(text) };
  }
}
