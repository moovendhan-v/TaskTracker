/**
 * E6 visual bug reports. A bug report is a task of type "bug" plus the details here, so it keeps
 * every task capability (assignees, comments, sprints, watchers, attachments, automations).
 */
import { REDACTED } from './redaction.js';

export const BUG_KINDS = ['bug', 'suggestion', 'enhancement', 'feature_request'] as const;
export type BugKind = (typeof BUG_KINDS)[number];
export const BUG_KIND_LABELS: Record<BugKind, string> = { bug: 'Bug', suggestion: 'Suggestion', enhancement: 'Enhancement', feature_request: 'Feature request' };

/** P0 is the most severe (everything down); P4 cosmetic. */
export const BUG_SEVERITIES = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
export type BugSeverity = (typeof BUG_SEVERITIES)[number];
export const BUG_SEVERITY_LABELS: Record<BugSeverity, string> = { P0: 'P0 · Blocker', P1: 'P1 · Critical', P2: 'P2 · Major', P3: 'P3 · Minor', P4: 'P4 · Trivial' };
/** The task priority a severity sets when a report is filed (it can be changed on the task after). */
export const SEVERITY_PRIORITY = { P0: 'urgent', P1: 'urgent', P2: 'high', P3: 'normal', P4: 'low' } as const satisfies Record<BugSeverity, string>;

export const BUG_ENVIRONMENTS = ['development', 'uat', 'staging', 'production'] as const;
export type BugEnvironment = (typeof BUG_ENVIRONMENTS)[number];
export const BUG_ENVIRONMENT_LABELS: Record<BugEnvironment, string> = { development: 'Development', uat: 'UAT', staging: 'Staging', production: 'Production' };

/** QA's view of a report, alongside the task's own status. */
export const BUG_QA_STATES = ['new', 'confirmed', 'fixed', 'retest', 'verified', 'reopened', 'closed', 'duplicate', 'wont_fix'] as const;
export type BugQaState = (typeof BUG_QA_STATES)[number];
export const BUG_QA_STATE_LABELS: Record<BugQaState, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  fixed: 'Fixed',
  retest: 'Ready to retest',
  verified: 'Verified',
  reopened: 'Reopened',
  closed: 'Closed',
  duplicate: 'Duplicate',
  wont_fix: "Won't fix",
};
/** Which QA states may follow which (anything may be closed; duplicates are set by linking). */
export const BUG_QA_TRANSITIONS: Record<BugQaState, readonly BugQaState[]> = {
  new: ['confirmed', 'closed', 'wont_fix'],
  confirmed: ['fixed', 'closed', 'wont_fix'],
  fixed: ['retest', 'reopened', 'closed'],
  retest: ['verified', 'reopened'],
  verified: ['closed', 'reopened'],
  reopened: ['confirmed', 'fixed', 'closed', 'wont_fix'],
  closed: ['reopened'],
  duplicate: ['reopened'],
  wont_fix: ['reopened'],
};

export const BUG_SOURCES = ['app', 'extension', 'sdk', 'portal', 'mcp', 'test_run'] as const;
export type BugSource = (typeof BUG_SOURCES)[number];

export interface BugStep {
  text: string;
  /** Typed by a person, or written from the captured actions. */
  source: 'manual' | 'captured';
}

export const CONSOLE_LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;
export type ConsoleLevel = (typeof CONSOLE_LEVELS)[number];

export interface ConsoleEntry {
  level: ConsoleLevel;
  message: string;
  /** Milliseconds since capture started. */
  at: number;
  stack?: string | null;
  /** An uncaught error or unhandled rejection rather than a console call. */
  uncaught?: boolean;
}

export interface NetworkEntry {
  method: string;
  url: string;
  /** 0 when the request never got an answer. */
  status: number;
  durationMs: number;
  at: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string | null;
  responseBody?: string | null;
  error?: string | null;
}

export const ACTION_TYPES = ['navigate', 'click', 'input', 'select', 'submit', 'key', 'scroll'] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface ActionEntry {
  type: ActionType;
  at: number;
  /** A readable description of the element: its label, text or role. */
  target?: string | null;
  /** CSS selector, for developers. */
  selector?: string | null;
  /** Typed text (passwords never kept) or the key pressed. */
  value?: string | null;
  url?: string | null;
}

export interface BugEnvironmentInfo {
  pageUrl: string | null;
  browser: string | null;
  os: string | null;
  viewport: string | null;
  userAgent: string | null;
}

export const BUG_LIMITS = {
  title: 200,
  text: 5_000,
  module: 80,
  steps: 50,
  stepText: 500,
  console: 200,
  network: 200,
  actions: 400,
  message: 2_000,
  /** Request and response bodies are kept short: the whole capture must fit one 1 MB request. */
  body: 2_000,
  url: 2_000,
  /** The capture as JSON (the API's request limit is 1 MB, with room for the rest of the report). */
  captureJson: 900_000,
} as const;

/** A failed request: no answer, or an HTTP error. */
export const isFailedRequest = (entry: Pick<NetworkEntry, 'status' | 'error'>): boolean => entry.status === 0 || entry.status >= 400 || Boolean(entry.error);

/** How many recorded steps a report keeps: the last ones, just before it was filed. */
export const CAPTURED_STEPS = 12;

/** Reproduction steps written from captured actions: "Go to /settings", "Click “Save”", "Type “abc” into Email". */
export function stepsFromActions(actions: readonly ActionEntry[]): BugStep[] {
  const steps: BugStep[] = [];
  let lastUrl: string | null = null;
  const quote = (text: string) => `“${text.length > 60 ? `${text.slice(0, 59)}…` : text}”`;
  for (const action of actions) {
    let text: string | null = null;
    switch (action.type) {
      case 'navigate':
        if (action.url && action.url !== lastUrl) text = `Go to ${pathOf(action.url)}`;
        lastUrl = action.url ?? lastUrl;
        break;
      case 'click':
        text = `Click ${action.target ? quote(action.target) : 'the page'}`;
        break;
      case 'input':
        text = action.value && action.value !== REDACTED ? `Type ${quote(action.value)} into ${action.target ? quote(action.target) : 'a field'}` : `Fill in ${action.target ? quote(action.target) : 'a field'}`;
        break;
      case 'select':
        text = `Choose ${quote(action.value ?? '')} in ${action.target ? quote(action.target) : 'a list'}`;
        break;
      case 'submit':
        text = `Submit ${action.target ? quote(action.target) : 'the form'}`;
        break;
      case 'key':
        if (action.value && ['Enter', 'Escape', 'Tab'].includes(action.value)) text = `Press ${action.value}`;
        break;
      case 'scroll':
        break;
    }
    // Repeated identical steps (typing in one field) collapse into the last one.
    if (text && steps.at(-1)?.text !== text) {
      if (action.type === 'input' && steps.length && steps.at(-1)!.text.includes(action.target ? quote(action.target) : 'a field')) steps.pop();
      steps.push({ text, source: 'captured' });
    }
  }
  // What led up to the report, not the whole session.
  return steps.slice(-CAPTURED_STEPS);
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    // Ids shortened to their first 8 characters: readable, still unique enough to follow.
    const path = parsed.pathname.replace(/([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '$1…');
    return `${path}${parsed.search ? '?…' : ''}` || '/';
  } catch {
    return url.slice(0, 200);
  }
}
