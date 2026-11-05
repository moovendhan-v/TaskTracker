import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * Small, dependency-free charts for dashboards. They follow one set of rules:
 * thin columns (max 24px) with a 4px rounded data end on a single baseline,
 * hairline gridlines, a legend whenever there are two or more series, text in
 * text colours (never the series colour) and a tooltip on hover or focus.
 */

const BAR_MAX = 24;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

function Tooltip({ left, children }: { left: string; children: ReactNode }) {
  return (
    <div role="status" className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md" style={{ left }}>
      {children}
    </div>
  );
}

export interface Column {
  key: string;
  /** Axis label under the column. */
  label: string;
  value: number;
  /** What the tooltip says, e.g. "Tue Oct 20 · 6 h 30 m". */
  tooltip: string;
  /** Colour token for this column; defaults to the series colour. */
  color?: string;
}

interface ColumnChartProps {
  data: readonly Column[];
  /** Accessible name; also what the chart's panel title says. */
  label: string;
  height?: number;
  color?: string;
  /** A labelled hairline, e.g. an 8 h working day. */
  reference?: { value: number; label: string };
  /** Which axis labels to show: all, or only the first and last. */
  axis?: 'all' | 'ends';
  formatValue?: (value: number) => string;
  /** Value labels on the column caps. Use only with a handful of columns. */
  showValues?: boolean;
}

/** Columns over a category or time axis: hours per day, counts per week. */
export function ColumnChart({ data, label, height = 160, color = 'var(--chart-1)', reference, axis = 'all', formatValue = String, showValues = false }: ColumnChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = niceMax(Math.max(reference?.value ?? 0, ...data.map((column) => column.value)));
  const pct = (value: number) => `${(value / max) * 100}%`;

  return (
    <figure aria-label={label} className="w-full">
      <div className="relative" style={{ height }}>
        <div className="absolute inset-x-0 bottom-0 border-t border-chart-grid" />
        <div className="absolute inset-x-0 top-0 border-t border-chart-grid" />
        {reference ? (
          <div className="absolute inset-x-0 border-t border-muted-foreground/40" style={{ bottom: pct(reference.value) }}>
            <span className="absolute -top-4 right-0 text-[10px] text-muted-foreground">{reference.label}</span>
          </div>
        ) : null}
        <div className="absolute inset-0 flex items-end gap-0.5">
          {data.map((column, index) => (
            <button
              key={column.key}
              type="button"
              aria-label={column.tooltip}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end focus-visible:outline-none"
            >
              {showValues && column.value > 0 ? <span className="mb-1 text-[11px] tabular-nums text-muted-foreground">{formatValue(column.value)}</span> : null}
              <span
                className={cn('w-full rounded-t-[4px] transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-ring', hovered !== null && hovered !== index && 'opacity-60')}
                style={{ height: column.value > 0 ? `max(2px, ${pct(column.value)})` : 0, maxWidth: BAR_MAX, background: column.color ?? color }}
              />
            </button>
          ))}
        </div>
        {hovered !== null && data[hovered] ? <Tooltip left={`${((hovered + 0.5) / data.length) * 100}%`}>{data[hovered].tooltip}</Tooltip> : null}
      </div>
      <figcaption className="mt-1.5 flex gap-0.5 text-[11px] text-muted-foreground">
        {axis === 'ends' ? (
          <>
            <span className="flex-1 truncate">{data[0]?.label}</span>
            <span className="flex-1 truncate text-right">{data[data.length - 1]?.label}</span>
          </>
        ) : (
          data.map((column) => (
            <span key={column.key} className="min-w-0 flex-1 truncate text-center">
              {column.label}
            </span>
          ))
        )}
      </figcaption>
    </figure>
  );
}

export interface Series {
  key: string;
  label: string;
  color: string;
}

interface GroupedColumnChartProps {
  series: readonly Series[];
  groups: readonly { key: string; label: string; values: readonly number[] }[];
  label: string;
  height?: number;
  /** A one-line takeaway shown at the right of the legend. */
  note?: ReactNode;
}

/** Two or three series side by side per group, e.g. tasks created vs closed per week. */
export function GroupedColumnChart({ series, groups, label, height = 160, note }: GroupedColumnChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = niceMax(Math.max(...groups.flatMap((group) => group.values)));
  const hoveredGroup = hovered === null ? undefined : groups[hovered];

  return (
    <figure aria-label={label} className="w-full">
      <Legend items={series} aside={note} />
      <div className="relative mt-3" style={{ height }}>
        <div className="absolute inset-x-0 bottom-0 border-t border-chart-grid" />
        <div className="absolute inset-0 flex items-end">
          {groups.map((group, index) => (
            <button
              key={group.key}
              type="button"
              aria-label={`${group.label}: ${series.map((item, i) => `${item.label} ${group.values[i] ?? 0}`).join(', ')}`}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 focus-visible:outline-none"
            >
              {series.map((item, i) => {
                const value = group.values[i] ?? 0;
                return <span key={item.key} className="w-full max-w-4 rounded-t-[4px]" style={{ height: value > 0 ? `max(2px, ${(value / max) * 100}%)` : 0, background: item.color }} />;
              })}
            </button>
          ))}
        </div>
        {hoveredGroup && hovered !== null ? (
          <Tooltip left={`${((hovered + 0.5) / groups.length) * 100}%`}>
            <span className="font-medium">{hoveredGroup.label}</span>
            {series.map((item, i) => (
              <span key={item.key} className="ml-2 inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: item.color }} />
                {item.label} {hoveredGroup.values[i] ?? 0}
              </span>
            ))}
          </Tooltip>
        ) : null}
      </div>
      <figcaption className="mt-1.5 flex text-[11px] text-muted-foreground">
        {groups.map((group) => (
          <span key={group.key} className="min-w-0 flex-1 truncate text-center">
            {group.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function Legend({ items, aside }: { items: readonly { key: string; label: string; color: string }[]; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
      {aside ? <span className="ml-auto">{aside}</span> : null}
    </div>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Parts of one whole in a single bar, with a legend that carries the numbers. */
export function StackedBar({ segments, label, showPercent = true }: { segments: readonly Segment[]; label: string; showPercent?: boolean }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  return (
    <figure aria-label={label} className="grid gap-3">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {visible.map((segment) => (
          <span key={segment.key} title={`${segment.label}: ${segment.value}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }} />
        ))}
      </div>
      <figcaption className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-6 gap-y-1.5 text-sm">
        {segments.map((segment) => (
          <span key={segment.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />
            <span className="min-w-0 flex-1 truncate">{segment.label}</span>
            <span className="font-medium tabular-nums">{segment.value}</span>
            {showPercent ? <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{total ? Math.round((segment.value / total) * 100) : 0}%</span> : null}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  /** The value as text, e.g. "22 h". */
  display: string;
}

/** Ranked horizontal bars: hours by person, project or task. Rows can be pickable (a page selection). */
export function BarList({
  rows,
  label,
  color = 'var(--chart-1)',
  empty = 'Nothing yet',
  onPick,
  isPicked,
}: {
  rows: readonly BarRow[];
  label: string;
  color?: string;
  empty?: string;
  /** Makes rows buttons; the caller ignores rows it can't pick (e.g. "no project"). */
  onPick?: (row: BarRow) => void;
  isPicked?: (row: BarRow) => boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const grid = 'grid w-full grid-cols-[minmax(0,1fr)_minmax(4rem,8rem)_auto] items-center gap-3 text-sm';
  return (
    <ul aria-label={label} className="grid gap-2.5">
      {rows.map((row) => {
        const body = (
          <>
            <span className="truncate">{row.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: color }} />
            </span>
            <span className="w-20 text-right font-medium whitespace-nowrap tabular-nums">{row.display}</span>
          </>
        );
        return (
          <li key={row.key}>
            {onPick ? (
              <button type="button" aria-pressed={isPicked?.(row) ?? false} onClick={() => onPick(row)} className={cn(grid, '-mx-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-muted/60 aria-pressed:bg-primary/10 aria-pressed:ring-1 aria-pressed:ring-primary/40')}>
                {body}
              </button>
            ) : (
              <div className={grid}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A slim progress meter with its own track. */
export function Meter({ value, label, className, color = 'var(--good)' }: { value: number; label: string; className?: string; color?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} className={cn('block h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <span className="block h-full rounded-full" style={{ width: `${clamped}%`, background: color }} />
    </span>
  );
}

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  /** One value per point; null leaves a gap (e.g. days still to come). */
  values: readonly (number | null)[];
  /** A reference line (target, ideal) drawn dashed and thinner. */
  reference?: boolean;
}

interface LineChartProps {
  series: readonly LineSeries[];
  /** Axis labels, one per point. */
  labels: readonly string[];
  label: string;
  height?: number;
  formatValue?: (value: number) => string;
  note?: ReactNode;
}

/** Lines over time on one axis, with a crosshair and tooltip: e.g. a sprint burndown against its ideal. */
export function LineChart({ series, labels, label, height = 180, formatValue = String, note }: LineChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const count = labels.length;
  const max = niceMax(Math.max(...series.flatMap((item) => item.values.filter((value): value is number => value !== null))));
  const x = (index: number) => (count <= 1 ? 50 : (index / (count - 1)) * 100);
  const y = (value: number) => 100 - (value / max) * 100;
  const path = (values: readonly (number | null)[]) =>
    values.reduce<string>((d, value, index) => (value === null ? d : `${d}${d && values[index - 1] !== null ? 'L' : 'M'}${x(index)},${y(value)}`), '');

  return (
    <figure aria-label={label} className="w-full">
      {series.length > 1 ? <Legend items={series} aside={note} /> : null}
      <div className="relative mt-3" style={{ height }}>
        <div className="absolute inset-x-0 top-0 border-t border-chart-grid" />
        <div className="absolute inset-x-0 top-1/2 border-t border-chart-grid" />
        <div className="absolute inset-x-0 bottom-0 border-t border-chart-grid" />
        <span className="absolute top-0.5 left-0 text-[10px] tabular-nums text-muted-foreground">{formatValue(max)}</span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          {hovered !== null ? <line x1={x(hovered)} x2={x(hovered)} y1={0} y2={100} stroke="currentColor" className="text-muted-foreground/40" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
          {series.map((item) => (
            <path
              key={item.key}
              d={path(item.values)}
              fill="none"
              stroke={item.color}
              strokeWidth={item.reference ? 1.5 : 2}
              strokeDasharray={item.reference ? '4 4' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {hovered !== null
          ? series.map((item) => {
              const value = item.values[hovered];
              return value === null || value === undefined || item.reference ? null : (
                <span
                  key={item.key}
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-card"
                  style={{ left: `${x(hovered)}%`, bottom: `${100 - y(value)}%`, background: item.color }}
                />
              );
            })
          : null}
        <div className="absolute inset-0 flex">
          {labels.map((text, index) => (
            <button
              key={index}
              type="button"
              aria-label={`${text}: ${series.map((item) => `${item.label} ${item.values[index] === null ? 'not yet' : formatValue(item.values[index] ?? 0)}`).join(', ')}`}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              className="h-full min-w-0 flex-1 focus-visible:outline-none"
            />
          ))}
        </div>
        {hovered !== null ? (
          <Tooltip left={`${x(hovered)}%`}>
            <span className="font-medium">{labels[hovered]}</span>
            {series.map((item) => (
              <span key={item.key} className="ml-2 inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: item.color }} />
                {item.label} {item.values[hovered] === null ? '–' : formatValue(item.values[hovered] ?? 0)}
              </span>
            ))}
          </Tooltip>
        ) : null}
      </div>
      <figcaption className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{labels[0]}</span>
        {count > 2 ? <span>{labels[Math.floor((count - 1) / 2)]}</span> : null}
        <span>{labels[count - 1]}</span>
      </figcaption>
    </figure>
  );
}

export interface SparkPoint {
  label: string;
  value: number;
}

/**
 * A small trend under a stat tile's number: a 2px line in a quiet ink, with the
 * latest point marked in the accent. Hovering shows each point's value; the
 * accessible name reads the whole series, so it never depends on the picture.
 */
export function Sparkline({ points, label, formatValue = String }: { points: readonly SparkPoint[]; label: string; formatValue?: (value: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const max = Math.max(1, ...points.map((point) => point.value));
  const step = 100 / (points.length - 1);
  // Two pixels of headroom top and bottom, so the line and marker never clip.
  const y = (value: number) => 26 - (value / max) * 22;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ');
  const last = points[points.length - 1]!;
  const shown = hover === null ? null : points[hover];
  return (
    <div className="relative mt-1 h-7" role="img" aria-label={`${label}: ${points.map((point) => `${point.label} ${formatValue(point.value)}`).join(', ')}`}>
      <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <path d={path} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Markers are HTML so they stay round while the line stretches. */}
      <span aria-hidden className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-card" style={{ left: '100%', top: `${(y(last.value) / 28) * 100}%` }} />
      {hover !== null && hover !== points.length - 1 ? (
        <span aria-hidden className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground ring-2 ring-card" style={{ left: `${hover * step}%`, top: `${(y(points[hover]!.value) / 28) * 100}%` }} />
      ) : null}
      <div aria-hidden className="absolute inset-0 flex" onMouseLeave={() => setHover(null)}>
        {points.map((point, index) => (
          <span key={point.label} className="h-full flex-1" onMouseEnter={() => setHover(index)} />
        ))}
      </div>
      {shown ? (
        <Tooltip left={`${(hover as number) * step}%`}>
          {shown.label}: <span className="font-medium tabular-nums">{formatValue(shown.value)}</span>
        </Tooltip>
      ) : null}
    </div>
  );
}
