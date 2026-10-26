import { Dialog as DialogPrimitive } from 'radix-ui';
import { XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-6xl',
  /** The task window. */
  wide: 'max-w-[1320px]',
  full: 'max-w-[calc(100vw-2rem)]',
} as const;

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** For screen readers when the visible header doesn't describe the dialog. */
  description?: ReactNode;
  /** Small text left of the title row, e.g. a breadcrumb. */
  eyebrow?: ReactNode;
  /** Controls at the right of the header, before the close button. */
  headerActions?: ReactNode;
  footer?: ReactNode;
  /** A second column on wide screens, e.g. activity next to a task. */
  aside?: ReactNode;
  size?: keyof typeof SIZES;
  /** Fixed height (dvh) so long content scrolls inside rather than resizing the dialog. */
  tall?: boolean;
  /** Hide the title visually (it stays for screen readers) when the body shows its own heading. */
  hideTitle?: boolean;
  children: ReactNode;
  className?: string;
}

/** The app's dialog: sizes, an optional side column, header actions and footer, all configurable. */
export function Modal({ open, onOpenChange, title, description, eyebrow, headerActions, footer, aside, size = 'md', tall = false, hideTitle = false, children, className }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            SIZES[size],
            tall ? (size === 'wide' ? 'h-[92dvh]' : 'h-[88dvh]') : 'max-h-[88dvh]',
            className,
          )}
        >
          <header className="flex shrink-0 items-center gap-3 border-b px-5 py-3">
            <div className="min-w-0 flex-1">
              {eyebrow ? <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">{eyebrow}</div> : null}
              <DialogPrimitive.Title className={cn('truncate text-base font-semibold', hideTitle && 'sr-only')}>{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
            </div>
            {headerActions}
            <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label="Close">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </header>
          <div className={cn('flex min-h-0 flex-1', aside ? 'flex-col lg:flex-row' : 'flex-col')}>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
            {aside ? <aside className="flex min-h-0 flex-col border-t bg-muted/20 lg:w-[400px] lg:shrink-0 lg:border-t-0 lg:border-l">{aside}</aside> : null}
          </div>
          {footer ? <footer className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3">{footer}</footer> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
