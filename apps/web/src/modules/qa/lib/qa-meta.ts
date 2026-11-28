import type { QaCasePriority, QaResult, QaStepResult } from '@taskflow/shared-types';

export const RESULT_TONE: Record<QaResult | 'not_run', string> = {
  passed: 'bg-good/15 text-good',
  failed: 'bg-critical/15 text-critical',
  blocked: 'bg-warning/15 text-warning',
  skipped: 'bg-muted text-muted-foreground',
  not_run: 'bg-muted/60 text-muted-foreground',
};

export const PRIORITY_TONE: Record<QaCasePriority, string> = {
  critical: 'text-critical',
  high: 'text-warning',
  medium: 'text-chart-1',
  low: 'text-muted-foreground',
};

/** The case's result from its steps: any failure fails it, any block blocks it, all passed passes. */
export function overallResult(steps: readonly QaStepResult[]): QaResult | null {
  if (!steps.length) return null;
  if (steps.some((step) => step.result === 'failed')) return 'failed';
  if (steps.some((step) => step.result === 'blocked')) return 'blocked';
  if (steps.every((step) => step.result === 'skipped')) return 'skipped';
  return steps.every((step) => step.result === 'passed' || step.result === 'skipped') ? 'passed' : null;
}
