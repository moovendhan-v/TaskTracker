import { LoaderCircleIcon } from 'lucide-react';

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center text-muted-foreground" role="status">
      <LoaderCircleIcon className="size-5 animate-spin" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
