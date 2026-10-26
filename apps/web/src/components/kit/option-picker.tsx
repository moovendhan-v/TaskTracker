import { CheckIcon, SearchIcon, XIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';

export interface PickerOption<T extends string = string> {
  value: T;
  label: string;
  /** A hex colour the server validated: shown as a dot. */
  color?: string;
  /** Show the label as a person's avatar. */
  person?: boolean;
  /** Anything else to draw before the label (an icon, a flag). */
  icon?: ReactNode;
  hint?: string;
}

interface OptionPickerProps<T extends string> {
  options: readonly PickerOption<T>[];
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  /** The button that opens the picker. Must accept a ref (a plain element or forwardRef component). */
  trigger: ReactNode;
  placeholder?: string;
  searchable?: boolean;
  /** Adds a first row that sets the value to null. */
  clearLabel?: string;
  disabled?: boolean;
  width?: string;
  align?: 'start' | 'center' | 'end';
  /** Accessible name for the option list. */
  label?: string;
}

/** A popover list with search, an optional "clear" row and a check on the current value. */
export function OptionPicker<T extends string>({
  options,
  value,
  onChange,
  trigger,
  placeholder = 'Search…',
  searchable = true,
  clearLabel,
  disabled,
  width = 'w-64',
  align = 'start',
  label,
}: OptionPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = query ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())) : options;
  const choose = (next: T | null) => {
    setOpen(false);
    setQuery('');
    if (next !== value) onChange(next);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className={cn('p-1', width)} align={align} onOpenAutoFocus={(event) => !searchable && event.preventDefault()}>
        {searchable ? (
          <div className="mb-1 flex items-center gap-2 border-b px-2 pt-1 pb-1.5">
            <SearchIcon className="size-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        ) : null}
        <div role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
          {clearLabel ? (
            <button
              type="button"
              role="option"
              aria-selected={value == null}
              onClick={() => choose(null)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              <XIcon className="size-3.5" /> {clearLabel}
            </button>
          ) : null}
          {shown.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => choose(option.value)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {option.person ? <UserAvatar name={option.label} className="size-5 text-[9px]" /> : null}
              {option.color && !option.person ? <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} /> : null}
              {option.icon}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.hint ? <span className="text-xs text-muted-foreground">{option.hint}</span> : null}
              {option.value === value ? <CheckIcon className="size-3.5 text-primary" /> : null}
            </button>
          ))}
          {shown.length === 0 ? <div className="px-3 py-4 text-center text-xs text-muted-foreground">Nothing found</div> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
