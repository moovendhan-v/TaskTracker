import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageModelError } from './language-model.port.js';
import { OpenAiCompatibleModel } from './openai-compatible.model.js';

const model = new OpenAiCompatibleModel({ baseUrl: 'https://ai.example.com/v1/', apiKey: 'key-123', timeoutMs: 1000 });
const request = { model: 'm1', messages: [{ role: 'user' as const, content: 'hello' }], maxOutputTokens: 100 };

describe('OpenAiCompatibleModel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts a chat completion with the key and reads the answer and usage', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Hi there' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await model.generate(request)).toEqual({ text: 'Hi there', inputTokens: 5, outputTokens: 2 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://ai.example.com/v1/chat/completions');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer key-123');
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'm1', max_tokens: 100 });
    expect(init.redirect).toBe('error');
  });

  it('turns provider failures into safe messages without echoing the provider body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"bad key key-123"}', { status: 401 })));
    await expect(model.generate(request)).rejects.toThrow(new LanguageModelError('The AI provider refused the request (401)'));
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"choices":[]}')));
    await expect(model.generate(request)).rejects.toThrow(/empty answer/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json')));
    await expect(model.generate(request)).rejects.toThrow(/unreadable/);
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(Object.assign(new Error('t'), { name: 'TimeoutError' }))));
    await expect(model.generate(request)).rejects.toThrow(/took too long/);
  });

  it('estimates tokens when the provider reports none', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'abcdefgh' } }] }))));
    expect(await model.generate(request)).toMatchObject({ outputTokens: 2 });
  });
});
