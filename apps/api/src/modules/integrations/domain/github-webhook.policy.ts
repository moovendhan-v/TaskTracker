import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PullRequestState } from '@taskflow/shared-types';

/** The parts of a pull_request event TaskFlow uses, checked and trimmed. */
export interface PullRequestEvent {
  action: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  url: string;
  branch: string;
  author: string;
  state: PullRequestState;
}

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** Rules for incoming GitHub webhooks, which are untrusted until their signature checks out. */
export const GithubWebhookPolicy = {
  /** Checks X-Hub-Signature-256 (HMAC-SHA256 of the exact raw body) in constant time. */
  signatureMatches(secret: string, rawBody: Buffer, header: string | undefined): boolean {
    if (!header?.startsWith('sha256=')) return false;
    const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'utf8');
    const given = Buffer.from(header.slice('sha256='.length), 'utf8');
    return given.length === expected.length && timingSafeEqual(given, expected);
  },

  /** Reads a pull_request payload; null when it isn't one we can use. */
  parsePullRequest(payload: unknown): PullRequestEvent | null {
    const root = record(payload);
    const pr = record(root['pull_request']);
    const number = pr['number'];
    const url = text(pr['html_url'], 500);
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 1 || !url.startsWith('https://github.com/')) return null;
    const merged = pr['merged'] === true;
    const state: PullRequestState = pr['state'] === 'closed' ? (merged ? 'merged' : 'closed') : 'open';
    return {
      action: text(root['action'], 40),
      repo: text(record(root['repository'])['full_name'], 201),
      number,
      title: text(pr['title'], 300),
      body: text(pr['body'], 65_536),
      url,
      branch: text(record(pr['head'])['ref'], 255),
      author: text(record(pr['user'])['login'], 100),
      state,
    };
  },
};
