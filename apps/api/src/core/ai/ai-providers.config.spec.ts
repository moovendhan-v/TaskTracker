import { describe, expect, it } from 'vitest';
import { loadAiProviders } from './ai-providers.config.js';

describe('loadAiProviders', () => {
  it('reads each listed provider; nothing listed means AI is off', () => {
    expect(loadAiProviders({}, 'production')).toEqual([]);
    const providers = loadAiProviders(
      {
        AI_PROVIDERS: 'gemini, cloudflare',
        AI_GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        AI_GEMINI_API_KEY: 'k1',
        AI_GEMINI_MODELS: 'gemini-2.5-flash, gemini-2.5-pro',
        AI_GEMINI_LABEL: 'Gemini',
        AI_CLOUDFLARE_BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1',
        AI_CLOUDFLARE_API_KEY: 'k2',
        AI_CLOUDFLARE_MODELS: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      },
      'production',
    );
    expect(providers.map(({ id, label, models, baseUrl }) => ({ id, label, models, baseUrl }))).toEqual([
      { id: 'gemini', label: 'Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro'], baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
      { id: 'cloudflare', label: 'cloudflare', models: ['@cf/meta/llama-3.3-70b-instruct-fp8-fast'], baseUrl: 'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1' },
    ]);
  });

  it('refuses unsafe or incomplete settings at startup, naming the variable but never a value', () => {
    const bad = (env: NodeJS.ProcessEnv, nodeEnv: 'production' | 'test' = 'production') => () => loadAiProviders({ AI_PROVIDERS: 'x', AI_X_MODELS: 'm', ...env }, nodeEnv);
    expect(bad({ AI_X_BASE_URL: 'http://api.example.com', AI_X_API_KEY: 'secret-value' })).toThrow(/AI_X_BASE_URL: must use https/);
    expect(bad({ AI_X_BASE_URL: 'https://api.example.com' })).toThrow(/AI_X_API_KEY: is required/);
    expect(bad({ AI_X_BASE_URL: 'https://user:pw@api.example.com', AI_X_API_KEY: 'k' })).toThrow(/not in the URL/);
    expect(bad({ AI_X_BASE_URL: 'fake://' })).toThrow(/tests and development only/);
    expect(() => loadAiProviders({ AI_PROVIDERS: 'Bad-Id' }, 'test')).toThrow(/lowercase/);
    try {
      bad({ AI_X_BASE_URL: 'http://api.example.com', AI_X_API_KEY: 'secret-value' })();
    } catch (error) {
      expect(String(error)).not.toContain('secret-value');
    }
    // A local model server (Ollama) needs no key; the fake is fine in tests.
    expect(loadAiProviders({ AI_PROVIDERS: 'ollama', AI_OLLAMA_BASE_URL: 'http://localhost:11434/v1', AI_OLLAMA_MODELS: 'llama3.1' }, 'production')[0]?.kind).toBe('openai-compatible');
    expect(loadAiProviders({ AI_PROVIDERS: 'x', AI_X_BASE_URL: 'fake://', AI_X_MODELS: 'm' }, 'test')[0]?.kind).toBe('fake');
  });
});
