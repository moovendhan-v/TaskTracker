import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export const PALETTE = ['#0f766e', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#64748b'];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={cn(
            'flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring',
            value === color && 'ring-2 ring-foreground/40',
          )}
          style={{ backgroundColor: color }}
        >
          {value === color ? <CheckIcon className="size-4 text-white" /> : null}
        </button>
      ))}
    </div>
  );
}
