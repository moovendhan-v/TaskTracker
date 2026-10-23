import { cn } from '@/lib/cn';

/** A small swatch for space and workspace colours. Colour comes from validated #rrggbb data. */
export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} />;
}
