import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inject } from 'vitest';

/** Raw messages the test SMTP server received for `to`, oldest first. */
export function messagesTo(to: string): string[] {
  const dir = inject('mailDir');
  return readdirSync(dir)
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .filter((message) => message.includes(`To: ${to}`));
}

/** Waits for the first message to `to` and returns it. */
export async function waitForMessageTo(to: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [message] = messagesTo(to);
    if (message) return message;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`No email to ${to} within ${timeoutMs}ms`);
}

/** Undoes quoted-printable soft line breaks and escapes, which mail bodies use for long lines such as links. */
export function decodeQuotedPrintable(text: string): string {
  return text.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}
