import {
  isSensitiveField,
  REDACTED,
  ACTION_TYPES,
  BUG_ENVIRONMENTS,
  BUG_KINDS,
  BUG_LIMITS,
  BUG_QA_TRANSITIONS,
  BUG_SEVERITIES,
  CONSOLE_LEVELS,
  isFailedRequest,
  redactBody,
  redactHeaders,
  redactText,
  redactUrl,
  type ActionEntry,
  type BugCaptureInput,
  type BugEnvironment,
  type BugKind,
  type BugQaState,
  type BugSeverity,
  type BugStep,
  type ConsoleEntry,
  type NetworkEntry,
} from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');
const optional = (value: unknown, max: number): string | null => {
  const out = text(value, max).trim();
  return out ? out : null;
};
const ms = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), 86_400_000) : 0);
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => ((allowed as readonly unknown[]).includes(value) ? (value as T) : fallback);

/** Captured diagnostics, cleaned and redacted, with their counts. Clients are never trusted to have redacted. */
export interface CleanCapture {
  console: ConsoleEntry[];
  network: NetworkEntry[];
  actions: ActionEntry[];
  consoleErrors: number;
  failedRequests: number;
}

export const BugPolicy = {
  kind: (value: unknown, fallback: BugKind = 'bug'): BugKind => pick(value, BUG_KINDS, fallback),
  severity: (value: unknown, fallback: BugSeverity = 'P2'): BugSeverity => pick(value, BUG_SEVERITIES, fallback),
  environment: (value: unknown, fallback: BugEnvironment = 'production'): BugEnvironment => pick(value, BUG_ENVIRONMENTS, fallback),

  title(value: string): string {
    const title = value.trim().replace(/\s+/g, ' ');
    if (!title) throw DomainError.invalid('Give the report a title');
    if (title.length > BUG_LIMITS.title) throw DomainError.invalid(`Keep the title under ${BUG_LIMITS.title} characters`);
    return title;
  },

  longText(value: string | null | undefined, what: string): string {
    const out = (value ?? '').trim();
    if (out.length > BUG_LIMITS.text) throw DomainError.invalid(`${what} is too long (${BUG_LIMITS.text} characters at most)`);
    return redactText(out);
  },

  module(value: string | null | undefined): string | null {
    const out = (value ?? '').trim();
    if (out.length > BUG_LIMITS.module) throw DomainError.invalid(`Keep the module under ${BUG_LIMITS.module} characters`);
    return out || null;
  },

  manualSteps(values: readonly string[] | null | undefined): BugStep[] {
    return (values ?? [])
      .map((value) => redactText(value.trim().slice(0, BUG_LIMITS.stepText)))
      .filter(Boolean)
      .slice(0, BUG_LIMITS.steps)
      .map((value) => ({ text: value, source: 'manual' as const }));
  },

  steps(values: readonly BugStep[] | null | undefined): BugStep[] {
    return (values ?? [])
      .map((step) => ({ text: redactText(text(step.text, BUG_LIMITS.stepText).trim()), source: step.source === 'captured' ? ('captured' as const) : ('manual' as const) }))
      .filter((step) => step.text)
      .slice(0, BUG_LIMITS.steps);
  },

  capture(input: BugCaptureInput | null | undefined): CleanCapture {
    const console = (input?.console ?? []).slice(-BUG_LIMITS.console).map(
      (entry): ConsoleEntry => ({
        level: pick(entry.level, CONSOLE_LEVELS, 'log'),
        message: redactText(text(entry.message, BUG_LIMITS.message)),
        at: ms(entry.at),
        stack: entry.stack ? redactText(text(entry.stack, BUG_LIMITS.message)) : null,
        uncaught: entry.uncaught === true,
      }),
    );
    const network = (input?.network ?? []).slice(-BUG_LIMITS.network).map(
      (entry): NetworkEntry => ({
        method: text(entry.method, 10).toUpperCase() || 'GET',
        url: redactUrl(text(entry.url, BUG_LIMITS.url)),
        status: Number.isInteger(entry.status) && entry.status >= 0 && entry.status < 1000 ? entry.status : 0,
        durationMs: ms(entry.durationMs),
        at: ms(entry.at),
        requestHeaders: redactHeaders(entry.requestHeaders),
        responseHeaders: redactHeaders(entry.responseHeaders),
        requestBody: redactBody(entry.requestBody, BUG_LIMITS.body),
        responseBody: redactBody(entry.responseBody, BUG_LIMITS.body),
        error: entry.error ? redactText(text(entry.error, 500)) : null,
      }),
    );
    const actions = (input?.actions ?? []).slice(-BUG_LIMITS.actions).map(
      (entry): ActionEntry => ({
        type: pick(entry.type, ACTION_TYPES, 'click'),
        at: ms(entry.at),
        target: optional(entry.target, 200),
        selector: optional(entry.selector, 300),
        // What was typed into a field that looks secret (password, token, card…) is never kept.
        value: entry.value ? (isSensitiveField({ name: entry.target ?? null, id: entry.selector ?? null }) ? REDACTED : redactText(text(entry.value, 200))) : null,
        url: entry.url ? redactUrl(text(entry.url, BUG_LIMITS.url)) : null,
      }),
    );
    return {
      console,
      network,
      actions,
      consoleErrors: console.filter((entry) => entry.level === 'error').length,
      failedRequests: network.filter(isFailedRequest).length,
    };
  },

  /** QA moves only along the allowed paths (anything can be reopened from a closed state). */
  assertTransition(from: BugQaState, to: BugQaState): void {
    if (from === to) return;
    if (!BUG_QA_TRANSITIONS[from].includes(to)) throw DomainError.invalid(`A report that is ${from.replace('_', ' ')} can't move to ${to.replace('_', ' ')}`);
  },

  /** Browser, OS and viewport from what the client says, trimmed to sane sizes. */
  context(input: { pageUrl?: string | null; browser?: string | null; os?: string | null; viewport?: string | null; userAgent?: string | null } | null | undefined) {
    const viewport = optional(input?.viewport, 20);
    return {
      pageUrl: input?.pageUrl ? redactUrl(text(input.pageUrl, BUG_LIMITS.url)) : null,
      browser: optional(input?.browser, 120),
      os: optional(input?.os, 120),
      viewport: viewport && /^\d{1,5}\s*[x×]\s*\d{1,5}$/.test(viewport) ? viewport.replace(/\s/g, '') : null,
      userAgent: optional(input?.userAgent, 500),
    };
  },
};
