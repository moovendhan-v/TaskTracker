import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { daysBetween, formatDay, shiftDay, startOfWeekDay, today, type Day } from '@/lib/days';

export interface DayRange {
  start: Day | null;
  due: Day | null;
}

const withYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "Oct 25", or "Oct 25, 2027" outside the current year. */
export function formatRangeDay(day: Day): string {
  return day.slice(0, 4) === today().slice(0, 4) ? formatDay(day, 'monthDay') : withYear.format(new Date(`${day}T12:00:00Z`));
}

function firstOfMonth(day: Day): Day {
  return `${day.slice(0, 7)}-01`;
}

function addMonths(month: Day, count: number): Day {
  const date = new Date(`${month}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + count, 1);
  return date.toISOString().slice(0, 10);
}

interface MonthProps {
  month: Day;
  range: DayRange;
  hover: Day | null;
  weekStart: number;
  onPick: (day: Day) => void;
  onHover: (day: Day | null) => void;
}

function Month({ month, range, hover, weekStart, onPick, onHover }: MonthProps) {
  const first = startOfWeekDay(month, weekStart);
  const days = Array.from({ length: 42 }, (_, index) => shiftDay(first, index));
  const now = today();
  // While only the start is chosen, preview the range up to the hovered day.
  const low = range.start;
  const high = range.due ?? (hover && low && hover >= low ? hover : low);
  return (
    <div className="w-[252px]">
      <div className="mb-1 text-center text-sm font-semibold">{formatDay(month, 'month')}</div>
      <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground uppercase">
        {days.slice(0, 7).map((day) => (
          <div key={day} className="py-1">
            {formatDay(day, 'weekday').slice(0, 1)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const inRange = Boolean(low && high && day >= low && day <= high);
          const edge = day === range.start || day === range.due;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onPick(day)}
              onMouseEnter={() => onHover(day)}
              aria-label={formatRangeDay(day)}
              aria-pressed={edge}
              className={cn(
                'relative h-8 text-xs transition-colors',
                inMonth ? 'text-foreground' : 'text-muted-foreground/60',
                inRange && !edge && 'bg-primary/20',
                inRange && day === low && 'rounded-l-full',
                inRange && day === high && 'rounded-r-full',
                edge && 'rounded-full bg-primary font-bold text-primary-foreground',
                !inRange && 'rounded-full hover:bg-muted',
                day === now && !edge && 'font-bold text-primary',
              )}
            >
              {Number(day.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RangeCalendarProps {
  start: Day | null;
  due: Day | null;
  onChange: (range: DayRange) => void;
  weekStart?: number;
}

/** Two clicks: the start date, then the due date, with the range previewed while you hover. */
export function RangeCalendar({ start, due, onChange, weekStart = 1 }: RangeCalendarProps) {
  const [range, setRange] = useState<DayRange>({ start, due });
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<Day | null>(null);
  const [month, setMonth] = useState(() => firstOfMonth(start ?? due ?? today()));

  const pick = (day: Day) => {
    if (!picking || !range.start) {
      setRange({ start: day, due: null });
      setPicking(true);
      return;
    }
    const next = day < range.start ? { start: day, due: range.start } : { start: range.start, due: day };
    setRange(next);
    setPicking(false);
    onChange(next);
  };
  const set = (next: DayRange) => {
    setRange(next);
    setPicking(false);
    onChange(next);
  };
  const length = range.start && range.due ? daysBetween(range.start, range.due) + 1 : 0;
  const previewDue = range.due ?? (picking && hover && range.start && hover >= range.start ? hover : null);

  return (
    <div className="p-2">
      <div className="mb-2 flex items-center gap-2">
        <button type="button" className="rounded-md p-1 hover:bg-muted" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
          <ChevronLeftIcon className="size-4" />
        </button>
        <div className="flex-1 text-center text-xs text-muted-foreground" aria-live="polite">
          {picking ? 'Now click the due date' : 'Click the start date, then the due date'}
        </div>
        <button type="button" className="rounded-md p-1 hover:bg-muted" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row" onMouseLeave={() => setHover(null)}>
        <Month month={month} range={range} hover={hover} weekStart={weekStart} onPick={pick} onHover={setHover} />
        <Month month={addMonths(month, 1)} range={range} hover={hover} weekStart={weekStart} onPick={pick} onHover={setHover} />
      </div>
      <div className="mt-3 flex items-center gap-2 border-t pt-2 text-xs">
        <span className="text-muted-foreground">
          {range.start ? formatRangeDay(range.start) : 'Start'} → {previewDue ? formatRangeDay(previewDue) : 'Due'}
        </span>
        {length > 0 ? (
          <span className="rounded-full bg-muted px-2 py-0.5">
            {length} day{length === 1 ? '' : 's'}
          </span>
        ) : null}
        <span className="flex-1" />
        <button type="button" className="rounded px-2 py-1 text-muted-foreground hover:bg-muted" onClick={() => set({ start: today(), due: today() })}>
          Today only
        </button>
        <button type="button" className="flex items-center gap-1 rounded px-2 py-1 text-destructive hover:bg-destructive/10" onClick={() => set({ start: null, due: null })}>
          <XIcon className="size-3" />
          Clear
        </button>
      </div>
    </div>
  );
}

interface DateRangeFieldProps {
  start: Day | null;
  due: Day | null;
  onChange: (range: DayRange) => void;
  /** A closed task is never shown as overdue. */
  closed?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  weekStart?: number;
}

/** A compact "start → due" button that opens the range calendar. Red when the due date has passed. */
export function DateRangeField({ start, due, onChange, closed, disabled, placeholder = 'Empty', className, weekStart }: DateRangeFieldProps) {
  const [open, setOpen] = useState(false);
  const label = start || due ? `${start ? formatRangeDay(start) : '?'} → ${due ? formatRangeDay(due) : '?'}` : placeholder;
  const overdue = Boolean(due && !closed && due < today());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`Dates: ${label}`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm whitespace-nowrap hover:bg-muted disabled:pointer-events-none',
            start || due ? (overdue ? 'text-critical' : 'text-foreground') : 'text-muted-foreground',
            className,
          )}
        >
          <CalendarDaysIcon className="size-3.5" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1" align="start">
        {open ? (
          <RangeCalendar
            start={start}
            due={due}
            weekStart={weekStart}
            onChange={(range) => {
              onChange(range);
              setOpen(false);
            }}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
