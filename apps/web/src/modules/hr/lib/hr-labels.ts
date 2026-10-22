import type { EmploymentType, LeaveStatus } from '@taskflow/shared-types';

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contractor: 'Contractor',
  intern: 'Intern',
};

export const LEAVE_STATUS_STYLE: Record<LeaveStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-status-in-review/15 text-status-in-review' },
  approved: { label: 'Approved', className: 'bg-status-done/15 text-status-done' },
  rejected: { label: 'Rejected', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
};

const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Formats a yyyy-mm-dd calendar day without time-zone drift. */
export function formatDay(isoDate: string | null): string {
  return isoDate ? dayFormat.format(new Date(`${isoDate}T00:00:00Z`)) : '—';
}
