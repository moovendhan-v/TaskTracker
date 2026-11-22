import { z } from 'zod';

/** A provider the server can call, as configured in the environment. The key never leaves the server. */
export interface AiProviderConfig {
  /** Short id from AI_PROVIDERS, e.g. "gemini". */
  id: string;
  label: string;
  /** "fake" only in tests and development (base URL fake://). */
  kind: 'openai-compatible' | 'fake';
  baseUrl: string;
  apiKey: string;
  /** Model ids this provider may use; the first is its default. */
  models: string[];
}

const ID = /^[a-z][a-z0-9_]{0,23}$/;
const MODEL = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]{0,119}$/;

/**
 * Reads AI_PROVIDERS (comma-separated ids) and, for each id, AI_<ID>_BASE_URL, AI_<ID>_API_KEY,
 * AI_<ID>_MODELS (comma-separated, first is the default) and optional AI_<ID>_LABEL. Any
 * OpenAI-compatible endpoint works: Gemini, Cloudflare Workers AI, Groq, OpenRouter, OpenAI, Ollama.
 * Throws on anything invalid, so a bad setting fails startup instead of the first request.
 */
export function loadAiProviders(source: NodeJS.ProcessEnv, nodeEnv: 'development' | 'test' | 'production'): AiProviderConfig[] {
  const ids = (source['AI_PROVIDERS'] ?? '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  const problems: string[] = [];
  const providers: AiProviderConfig[] = [];
  for (const id of new Set(ids)) {
    if (!ID.test(id)) {
      problems.push(`AI_PROVIDERS: "${id.slice(0, 30)}" must be lowercase letters, digits or _ (up to 24)`);
      continue;
    }
    const key = (name: string) => `AI_${id.toUpperCase()}_${name}`;
    const parsed = z
      .object({
        baseUrl: z.string().trim().min(1, 'is required'),
        apiKey: z.string().trim().default(''),
        models: z.string().trim().min(1, 'is required'),
        label: z.string().trim().max(40).optional(),
      })
      .safeParse({ baseUrl: source[key('BASE_URL')], apiKey: source[key('API_KEY')], models: source[key('MODELS')], label: source[key('LABEL')] || undefined });
    if (!parsed.success) {
      problems.push(...parsed.error.issues.map((issue) => `${key(String(issue.path[0]) === 'baseUrl' ? 'BASE_URL' : String(issue.path[0]).toUpperCase())}: ${issue.message}`));
      continue;
    }
    const { baseUrl, apiKey, models: modelList, label } = parsed.data;
    const models = [...new Set(modelList.split(',').map((model) => model.trim()).filter(Boolean))];
    if (models.length === 0 || models.some((model) => !MODEL.test(model))) {
      problems.push(`${key('MODELS')}: list model ids separated by commas`);
      continue;
    }
    if (baseUrl === 'fake://') {
      if (nodeEnv === 'production') problems.push(`${key('BASE_URL')}: fake:// is for tests and development only`);
      else providers.push({ id, label: label ?? id, kind: 'fake', baseUrl, apiKey: '', models });
      continue;
    }
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      problems.push(`${key('BASE_URL')}: must be a URL`);
      continue;
    }
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === 'ollama';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (nodeEnv !== 'production' || local))) {
      problems.push(`${key('BASE_URL')}: must use https:// (http:// only for a local model server)`);
      continue;
    }
    if (url.username || url.password) {
      problems.push(`${key('BASE_URL')}: put the key in ${key('API_KEY')}, not in the URL`);
      continue;
    }
    if (!apiKey && !local) {
      problems.push(`${key('API_KEY')}: is required for a hosted provider`);
      continue;
    }
    providers.push({ id, label: label ?? id, kind: 'openai-compatible', baseUrl: url.toString().replace(/\/+$/, ''), apiKey, models });
  }
  if (problems.length) throw new Error(`Invalid AI configuration:\n${problems.join('\n')}`);
  return providers;
}
