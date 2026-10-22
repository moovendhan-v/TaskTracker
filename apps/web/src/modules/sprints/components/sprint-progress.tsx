export function SprintProgress({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="grid gap-1">
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Sprint progress"
      >
        <div className="h-full rounded-full bg-status-done transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {done} of {total} done · {percent}%
      </p>
    </div>
  );
}
