import { XIcon } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { useRef, type ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { useSwipeDismiss } from '@/lib/swipe';

export const Sheet = SheetPrimitive.Root;
export const SheetClose = SheetPrimitive.Close;

/** A side panel: on the right for task details, on the left for the phone and tablet navigation. */
export function SheetContent({ className, children, side = 'right', style, ...props }: ComponentProps<typeof SheetPrimitive.Content> & { side?: 'left' | 'right' }) {
  const close = useRef<HTMLButtonElement>(null);
  // Swipe it back toward the edge it came from (F1).
  const swipe = useSwipeDismiss(side === 'left' ? 'left' : 'right', () => close.current?.click());
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <SheetPrimitive.Content
        className={cn(
          side === 'left'
            ? 'fixed inset-y-0 left-0 z-50 flex h-full w-full flex-col border-r bg-background shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-left'
            : 'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l bg-background shadow-xl sm:max-w-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
          className,
        )}
        style={{ ...style, ...swipe.style }}
        {...swipe.handlers}
        {...props}
      >
        {children}
        <SheetPrimitive.Close ref={close} className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('text-base font-semibold', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
