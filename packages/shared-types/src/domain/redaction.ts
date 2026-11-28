/**
 * Removes credentials from captured diagnostics before they are stored or shown. Runs in the browser
 * (capture) and again on the server (anything sent to the API), so a stale or tampered client can't
 * skip it. Redaction is by name (headers, query parameters, JSON keys) and by shape (JWTs, bearer
 * tokens, card numbers, long secrets inside text).
 */
export const REDACTED = '[redacted]';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-xsrf-token',
  'x-amz-security-token',
  'x-goog-api-key',
  'x-hub-signature-256',
]);

/** Keys whose values are secrets (JSON bodies, query strings, form fields). */
const SENSITIVE_KEY = /pass(word|wd|phrase)?|secret|token|api[-_]?key|apikey|auth|cookie|session|sid$|^sig$|signature|credential|private[-_]?key|card|cvv|cvc|ssn|otp|pin$|^code$/i;

const PATTERNS: [RegExp, string][] = [
  // JSON web tokens
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, REDACTED],
  // "Bearer …", "Basic …"
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`],
  // key=value / key: value pairs with sensitive names inside free text
  [/\b((?:pass(?:word)?|secret|token|api[-_]?key|apikey|access[-_]?token|refresh[-_]?token|session(?:id)?|cookie)["']?\s*[:=]\s*["']?)[^\s"'&,;]{3,}/gi, `$1${REDACTED}`],
  // Card numbers (13–19 digits, optionally spaced)
  [/\b(?:\d[ -]?){13,19}\b/g, REDACTED],
  // Well-known key prefixes (GitHub, Stripe, Slack, AWS, Google)
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk_(?:live|test)_[A-Za-z0-9]{10,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,})\b/g, REDACTED],
];

export function redactText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

export function redactHeaders(headers: Record<string, string> | undefined | null): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers).slice(0, 60)) {
    const key = name.toLowerCase().slice(0, 100);
    out[key] = SENSITIVE_HEADERS.has(key) || SENSITIVE_KEY.test(key) ? REDACTED : redactText(String(value).slice(0, 1_000));
  }
  return out;
}

export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.username || url.password) {
      url.username = '';
      url.password = '';
    }
    for (const key of [...url.searchParams.keys()]) if (SENSITIVE_KEY.test(key)) url.searchParams.set(key, REDACTED);
    // Fragments often carry OAuth tokens.
    if (/access_token|id_token|token=/i.test(url.hash)) url.hash = `#${REDACTED}`;
    return redactText(url.toString());
  } catch {
    return redactText(raw);
  }
}

/** A request or response body: JSON keys by name, form fields by name, then text patterns. */
export function redactBody(body: string | null | undefined, max = 10_000): string | null {
  if (body === null || body === undefined || body === '') return null;
  const text = body.slice(0, max * 2);
  try {
    const parsed: unknown = JSON.parse(text);
    return JSON.stringify(redactJson(parsed)).slice(0, max);
  } catch {
    // not JSON
  }
  if (/^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(text.trim())) {
    const form = new URLSearchParams(text.trim());
    for (const key of [...form.keys()]) if (SENSITIVE_KEY.test(key)) form.set(key, REDACTED);
    return redactText(form.toString()).slice(0, max);
  }
  return redactText(text).slice(0, max);
}

export function redactJson(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[…]';
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => redactJson(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 200)) out[key] = SENSITIVE_KEY.test(key) && item !== null && typeof item !== 'object' ? REDACTED : redactJson(item, depth + 1);
    return out;
  }
  return value;
}

/** Whether a form field's value must never be captured (passwords, card data, one-time codes). */
export function isSensitiveField(field: { type?: string | null; name?: string | null; id?: string | null; autocomplete?: string | null }): boolean {
  if (field.type === 'password' || field.type === 'hidden') return true;
  if (field.autocomplete && /cc-|one-time-code|current-password|new-password/i.test(field.autocomplete)) return true;
  return SENSITIVE_KEY.test(`${field.name ?? ''} ${field.id ?? ''}`.trim() || '_');
}
