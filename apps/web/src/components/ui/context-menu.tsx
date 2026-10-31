import { ContextMenu as MenuPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Right-click (or the Menu key / Shift+F10) menu. Same look as the dropdown menu. */
export const ContextMenu = MenuPrimitive.Root;
export const ContextMenuTrigger = MenuPrimitive.Trigger;

export function ContextMenuContent({ className, ...props }: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        className={cn(
          'z-50 min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function ContextMenuItem({ className, shortcut, children, ...props }: ComponentProps<typeof MenuPrimitive.Item> & { shortcut?: string }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
      {shortcut ? <span className="ml-auto pl-4 font-mono text-[10.5px] text-subtle-foreground">{shortcut}</span> : null}
    </MenuPrimitive.Item>
  );
}

export function ContextMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
