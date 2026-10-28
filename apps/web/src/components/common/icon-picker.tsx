import { CheckIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ICON_KEYS, type IconKey } from '@taskflow/shared-types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { PALETTE } from './color-picker';
import { ICONS } from './entity-icon';

export interface Appearance {
  icon: IconKey | null;
  color: string | null;
}

interface IconGridProps {
  value: Appearance;
  onChange: (value: Appearance) => void;
  /** Hide the colour row for things that are never tinted. */
  withColor?: boolean;
  /** Offer "no colour" (lists and folders may follow the theme). */
  colorOptional?: boolean;
}

/** A grid of icons and a row of colours, for forms and popovers. */
export function IconGrid({ value, onChange, withColor = true, colorOptional = true }: IconGridProps) {
  const [query, setQuery] = useState('');
  const keys = ICON_KEYS.filter((key) => key.includes(query.trim().toLowerCase()));

  return (
    <div className="grid gap-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search icons"
        aria-label="Search icons"
        maxLength={30}
        className="h-8 rounded-md border bg-muted/40 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div role="radiogroup" aria-label="Icon" className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto">
        <button
          type="button"
          role="radio"
          aria-checked={value.icon === null}
          title="No icon"
          onClick={() => onChange({ ...value, icon: null })}
          className={cn('flex size-7 items-center justify-center rounded-md text-xs text-muted-foreground hover:bg-muted', value.icon === null && 'bg-primary/15 ring-1 ring-primary')}
        >
          —
        </button>
        {keys.map((key) => {
          const Icon = ICONS[key];
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value.icon === key}
              aria-label={key}
              title={key}
              onClick={() => onChange({ ...value, icon: key })}
              className={cn('flex size-7 items-center justify-center rounded-md hover:bg-muted', value.icon === key && 'bg-primary/15 ring-1 ring-primary')}
            >
              <Icon className="size-4" style={value.color ? { color: value.color } : undefined} />
            </button>
          );
        })}
      </div>
      {withColor ? (
        <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-1.5 border-t pt-2">
          {colorOptional ? (
            <button
              type="button"
              role="radio"
              aria-checked={value.color === null}
              title="Default colour"
              onClick={() => onChange({ ...value, color: null })}
              className={cn('size-6 rounded-full border bg-[conic-gradient(var(--muted-foreground),var(--muted),var(--muted-foreground))]', value.color === null && 'ring-2 ring-foreground/40 ring-offset-2 ring-offset-background')}
            />
          ) : null}
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={value.color === color}
              aria-label={color}
              onClick={() => onChange({ ...value, color })}
              className={cn('flex size-6 items-center justify-center rounded-full', value.color === color && 'ring-2 ring-foreground/40 ring-offset-2 ring-offset-background')}
              style={{ backgroundColor: color }}
            >
              {value.color === color ? <CheckIcon className="size-3.5 text-white" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface IconPickerProps extends IconGridProps {
  trigger: ReactNode;
}

/** The icon grid in a popover; each pick is applied straight away. */
export function IconPicker({ trigger, ...grid }: IconPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72" onClick={(event) => event.stopPropagation()}>
        <IconGrid {...grid} />
      </PopoverContent>
    </Popover>
  );
}
