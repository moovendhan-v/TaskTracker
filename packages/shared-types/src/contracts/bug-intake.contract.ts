import type { BugEnvironment, BugKind, BugQaState, BugSeverity, BugStep, BugSource } from '../domain/bug.js';
import type { BugCaptureResponse } from './bug.contract.js';

/**
 * E6.3 public intake: the embeddable feedback widget and the hosted feedback portal file reports
 * into one project through its public key. Read-only links let reporters follow a report (status)
 * and let members share one outside the workspace (full).
 */
export const INTAKE_KEY_PREFIX = 'tfk_';
export const SHARE_TOKEN_PREFIX = 'tfs_';
export const INTAKE_LIMITS = {
  title: 120,
  intro: 1_000,
  origins: 20,
  /** A screenshot sent with a public report, base64 in the JSON body (the API takes up to 1 MB). */
  screenshotBytes: 700_000,
  /** Public reports per project per hour, whatever their IPs. */
  perProjectHour: 60,
  reporterName: 80,
  reporterEmail: 200,
} as const;
export const BUG_SHARE_SCOPES = ['full', 'status'] as const;
export type BugShareScope = (typeof BUG_SHARE_SCOPES)[number];
export const BUG_SHARE_DAYS = [1, 7, 30] as const;
/** How long a reporter's tracking link lasts. */
export const TRACKING_LINK_DAYS = 180;

export interface BugIntakeResponse {
  id: string;
  spaceId: string;
  publicKey: string;
  title: string;
  intro: string;
  allowedOrigins: string[];
  widgetEnabled: boolean;
  portalEnabled: boolean;
  updatedAt: string;
}

export interface SaveBugIntakeRequest {
  title: string;
  intro?: string | null;
  allowedOrigins: string[];
  widgetEnabled: boolean;
  portalEnabled: boolean;
}

/** What the widget and the portal read before showing the form. */
export interface PublicIntakeConfig {
  title: string;
  intro: string;
  widget: boolean;
  portal: boolean;
  /** Turnstile site key when a CAPTCHA is required; null when the server has none. */
  captchaSiteKey: string | null;
}

export interface PublicReportRequest {
  via: 'widget' | 'portal';
  kind?: BugKind | null;
  title: string;
  actual?: string | null;
  expected?: string | null;
  steps?: string[] | null;
  name?: string | null;
  email?: string | null;
  context?: { pageUrl?: string | null; browser?: string | null; os?: string | null; viewport?: string | null; userAgent?: string | null } | null;
  captureJson?: string | null;
  /** data:image/png;base64,… or image/jpeg / image/webp, up to INTAKE_LIMITS.screenshotBytes. */
  screenshot?: string | null;
  captchaToken?: string | null;
  /** A field people never see: bots fill it in. Must be empty. */
  website?: string | null;
}

export interface PublicReportResponse {
  number: number;
  /** A path on the TaskFlow server where the reporter can follow the report (status only). */
  trackingPath: string;
}

export interface BugShareResponse {
  id: string;
  scope: BugShareScope;
  createdAt: string;
  expiresAt: string;
  lastViewedAt: string | null;
  createdByName: string | null;
}

export interface CreatedBugShare {
  share: BugShareResponse;
  /** Shown once: the link isn't stored, only its hash. */
  path: string;
}

/** A report as a read-only link shows it. Status links leave out the details and diagnostics. */
export interface PublicBugView {
  scope: BugShareScope;
  number: number;
  title: string;
  kind: BugKind;
  severity: BugSeverity | null;
  environment: BugEnvironment | null;
  qaState: BugQaState;
  statusName: string;
  statusCategory: string;
  source: BugSource;
  createdAt: string;
  updatedAt: string;
  expected: string | null;
  actual: string | null;
  steps: BugStep[];
  pageUrl: string | null;
  browser: string | null;
  os: string | null;
  viewport: string | null;
  files: { fileName: string; url: string; isImage: boolean; isVideo: boolean }[];
  capture: BugCaptureResponse | null;
  expiresAt: string;
}
