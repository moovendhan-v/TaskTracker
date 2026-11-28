import type { BugQaState, BugSeverity } from '@taskflow/shared-types';

/** Severity chip colours: hotter for worse. */
export const SEVERITY_TONE: Record<BugSeverity, string> = {
  P0: 'bg-critical text-white',
  P1: 'bg-critical/15 text-critical',
  P2: 'bg-warning/15 text-warning',
  P3: 'bg-chart-1/15 text-chart-1',
  P4: 'bg-muted text-muted-foreground',
};

export const QA_TONE: Record<BugQaState, string> = {
  new: 'bg-chart-1/15 text-chart-1',
  confirmed: 'bg-warning/15 text-warning',
  fixed: 'bg-good/15 text-good',
  retest: 'bg-chart-2/15 text-chart-2',
  verified: 'bg-good text-white',
  reopened: 'bg-critical/15 text-critical',
  closed: 'bg-muted text-muted-foreground',
  duplicate: 'bg-muted text-muted-foreground',
  wont_fix: 'bg-muted text-muted-foreground',
};

/** The button label for moving a report to a QA state. */
export const QA_ACTION: Record<BugQaState, string> = {
  new: 'Back to new',
  confirmed: 'Confirm',
  fixed: 'Mark fixed',
  retest: 'Ask for a retest',
  verified: 'Verify',
  reopened: 'Reopen',
  closed: 'Close',
  duplicate: 'Duplicate',
  wont_fix: "Won't fix",
};

/** mm:ss.s since capture started. */
export function captureTime(ms: number): string {
  const seconds = ms / 1000;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}

export const isVideo = (fileName: string) => /\.(webm|mp4)$/i.test(fileName);
