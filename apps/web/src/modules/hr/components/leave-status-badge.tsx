import type { LeaveStatus } from '@taskflow/shared-types';
import { Badge } from '@/components/ui/badge';
import { LEAVE_STATUS_STYLE } from '../lib/hr-labels';

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const style = LEAVE_STATUS_STYLE[status];
  return <Badge className={style.className}>{style.label}</Badge>;
}
