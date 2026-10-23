import type { LeaveBalanceResponse } from '@taskflow/shared-types';
import { Card } from '@/components/ui/card';

export function LeaveBalanceCard({ balance }: { balance: LeaveBalanceResponse }) {
  const unlimited = balance.allowanceDays === null;
  const percentUsed = unlimited || !balance.allowanceDays ? 0 : Math.min(100, (balance.usedDays / balance.allowanceDays) * 100);

  return (
    <Card className="grid gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: balance.color }} aria-hidden />
        <h3 className="text-sm font-semibold">{balance.leaveTypeName}</h3>
      </div>
      <p className="text-3xl font-semibold tabular-nums">
        {unlimited ? '∞' : balance.remainingDays}
        <span className="ml-1 text-sm font-normal text-muted-foreground">{unlimited ? 'unlimited' : `of ${balance.allowanceDays} days left`}</span>
      </p>
      {!unlimited ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${percentUsed}%`, backgroundColor: balance.color }} />
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {balance.usedDays} used · {balance.pendingDays} pending
      </p>
    </Card>
  );
}
