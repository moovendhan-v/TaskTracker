import { GRID_COLUMNS, type LayoutItem } from '@taskflow/shared-types';
import { PlusIcon, XIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type DragEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { gridHeight, moveItem, resizeItem, type FixedIds } from '../lib/grid';

/** Height of one grid row and the gap between cells, in px. */
export const ROW_HEIGHT = 48;
export const GAP = 16;

/** A soft spring: blocks overshoot a touch and settle, like they're pushed aside and snap back. */
const SPRING = 'cubic-bezier(0.22, 1.3, 0.36, 1)';
const MOVE_MS = 520;
/** Empty rows shown below the blocks while arranging, so there is room to drop. */
const SPARE_ROWS = 4;
/** The id a widget being dragged in from the tray has until it lands. */
const INCOMING = '__incoming';

const WIDE = '(min-width: 1024px)';
const REDUCED = '(prefers-reduced-motion: reduce)';
const subscribeTo = (query: string) => (callback: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const subscribeWide = subscribeTo(WIDE);
const subscribeReduced = subscribeTo(REDUCED);
/** The grid needs room for 12 columns; narrower screens stack the blocks instead. */
function useWideScreen(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
}

/**
 * A widget dragged from the tray (B2 "parrilla"). The tray sets it on dragstart; the
 * browser only tells a drop target the data's type while dragging, not its content.
 */
export interface IncomingWidget {
  type: string;
  title: string;
  w: number;
  h: number;
}
let incomingWidget: IncomingWidget | null = null;
export const TRAY_DRAG_TYPE = 'application/x-taskflow-widget';
export function startTrayDrag(event: DragEvent, widget: IncomingWidget): void {
  incomingWidget = widget;
  event.dataTransfer.setData(TRAY_DRAG_TYPE, widget.type);
  event.dataTransfer.effectAllowed = 'copy';
}
export function endTrayDrag(): void {
  incomingWidget = null;
}

interface Drag {
  id: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  base: LayoutItem[];
  origin: LayoutItem;
  /** Pointer offset in px, for the block that follows the pointer while moving. */
  dx: number;
  dy: number;
}

interface BlockGridProps {
  items: LayoutItem[];
  arranging: boolean;
  /** A finished change (drop, resize, keyboard move): saved and undoable. */
  onChange: (items: LayoutItem[]) => void;
  onRemove: (item: LayoutItem) => void;
  titleOf: (item: LayoutItem) => string;
  renderBlock: (item: LayoutItem) => ReactNode;
  /** Blocks pinned by the workspace: they don't move, resize or go, and others flow around them. */
  fixed?: FixedIds;
  /** A widget dropped in from the tray, at this cell. */
  onDropNew?: (type: string, at: { x: number; y: number }) => void;
}

const NO_FIXED: FixedIds = new Set();

const describe = (item: LayoutItem) => `column ${item.x + 1}, row ${item.y + 1}, ${item.w} wide, ${item.h} tall`;

/**
 * Blocks on a 12-column grid (v2 "lego" layout). In arrange mode a block can be
 * dragged by any point, resized from its corner, removed with ×, or moved from
 * the keyboard: focus it, then ⌥+arrows moves and ⇧⌥+arrows resizes. Widgets
 * from the tray drop straight onto a cell.
 *
 * Motion: the dragged block lifts and follows the pointer; the others glide out of
 * its way and back (measured before and after each change, then animated from the
 * old spot with a spring); new blocks pop in, removed ones shrink away. None of it
 * runs for people who ask for reduced motion.
 */
export function BlockGrid({ items, arranging, onChange, onRemove, titleOf, renderBlock, fixed = NO_FIXED, onDropNew }: BlockGridProps) {
  const wide = useWideScreen();
  const reduced = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const [dragState, setDrag] = useState<Drag | null>(null);
  const [previewState, setPreview] = useState<LayoutItem[] | null>(null);
  const [incoming, setIncoming] = useState<{ widget: IncomingWidget; preview: LayoutItem[] } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const editable = arranging && wide;
  // Leaving arrange mode mid-drag simply drops the drag.
  const drag = editable ? dragState : null;
  const preview = editable ? (previewState ?? incoming?.preview ?? null) : null;
  const shown = preview ?? items;

  // Where every block was last time, by id, relative to the grid: the "first" of FLIP.
  const positions = useRef(new Map<string, { left: number; top: number }>());
  const mounted = useRef(false);
  useLayoutEffect(() => {
    const grid = container.current;
    if (!grid) return;
    const next = new Map<string, { left: number; top: number }>();
    for (const element of grid.querySelectorAll<HTMLElement>(':scope > [data-block-id]')) {
      const id = element.dataset['blockId']!;
      const now = { left: element.offsetLeft, top: element.offsetTop };
      next.set(id, now);
      if (reduced || (id === drag?.id && drag.mode === 'move')) continue;
      const before = positions.current.get(id);
      if (!before) {
        // New on the page (not the first paint): pop in.
        if (mounted.current && id !== INCOMING) element.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: MOVE_MS, easing: SPRING });
        continue;
      }
      const dx = before.left - now.left;
      const dy = before.top - now.top;
      if (dx || dy) element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: MOVE_MS, easing: SPRING });
    }
    positions.current = next;
    mounted.current = true;
  });

  const cell = () => {
    const width = container.current?.clientWidth ?? 1200;
    return { x: (width - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS + GAP, y: ROW_HEIGHT + GAP };
  };

  const start = (event: PointerEvent, item: LayoutItem, mode: Drag['mode']) => {
    if (!editable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({ id: item.id, mode, startX: event.clientX, startY: event.clientY, base: items, origin: item, dx: 0, dy: 0 });
  };

  const track = (event: PointerEvent) => {
    if (!drag) return;
    const size = cell();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const cols = Math.round(dx / size.x);
    const rows = Math.round(dy / size.y);
    const { origin } = drag;
    setDrag({ ...drag, dx, dy });
    setPreview(drag.mode === 'move' ? moveItem(drag.base, origin.id, origin.x + cols, origin.y + rows, fixed) : resizeItem(drag.base, origin.id, origin.w + cols, origin.h + rows, fixed));
  };

  const finish = () => {
    if (!drag) return;
    // The block settles from where it was let go, not from where it started.
    const element = container.current?.querySelector<HTMLElement>(`:scope > [data-block-id="${CSS.escape(drag.id)}"]`);
    if (element && drag.mode === 'move') positions.current.set(drag.id, { left: element.offsetLeft + drag.dx, top: element.offsetTop + drag.dy });
    const placed = preview?.find((item) => item.id === drag.id);
    if (preview && placed && JSON.stringify(preview) !== JSON.stringify(drag.base)) {
      onChange(preview);
      setAnnouncement(`${titleOf(placed)} ${drag.mode === 'move' ? 'moved' : 'resized'}: ${describe(placed)}`);
    }
    setDrag(null);
    setPreview(null);
  };

  /** Removed blocks shrink away first, then leave the layout. */
  const remove = (item: LayoutItem) => {
    const element = container.current?.querySelector<HTMLElement>(`:scope > [data-block-id="${CSS.escape(item.id)}"]`);
    if (!element || reduced) return onRemove(item);
    element.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.7)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).finished.then(
      () => onRemove(item),
      () => onRemove(item),
    );
  };

  const onKey = (event: KeyboardEvent, item: LayoutItem) => {
    if (!editable || fixed.has(item.id)) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && event.target === event.currentTarget) {
      event.preventDefault();
      remove(item);
      return;
    }
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!step || !event.altKey) return;
    event.preventDefault();
    const [dx, dy] = step as [number, number];
    const next = event.shiftKey ? resizeItem(items, item.id, item.w + dx, item.h + dy, fixed) : moveItem(items, item.id, item.x + dx, item.y + dy, fixed);
    const placed = next.find((other) => other.id === item.id)!;
    onChange(next);
    setAnnouncement(`${titleOf(item)}: ${describe(placed)}`);
  };

  // A widget from the tray: where it would land under the pointer, with the others moving aside.
  const cellAt = (event: DragEvent, widget: IncomingWidget) => {
    const box = container.current!.getBoundingClientRect();
    const size = cell();
    const x = Math.min(GRID_COLUMNS - widget.w, Math.max(0, Math.floor((event.clientX - box.left) / size.x - widget.w / 2 + 0.5)));
    const y = Math.max(0, Math.floor((event.clientY - box.top) / size.y - 0.5));
    return { x, y };
  };
  const dragOver = (event: DragEvent) => {
    const widget = incomingWidget;
    if (!editable || !onDropNew || !widget || !event.dataTransfer.types.includes(TRAY_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const at = cellAt(event, widget);
    const current = incoming?.preview.find((item) => item.id === INCOMING);
    if (current && incoming?.widget.type === widget.type && current.x === at.x && current.y === at.y) return;
    const ghost: LayoutItem = { id: INCOMING, type: widget.type, x: at.x, y: at.y, w: widget.w, h: widget.h };
    setIncoming({ widget, preview: moveItem([...items, ghost], INCOMING, at.x, at.y, fixed) });
  };
  const dragLeave = (event: DragEvent) => {
    if (!container.current?.contains(event.relatedTarget as Node | null)) setIncoming(null);
  };
  const drop = (event: DragEvent) => {
    const landed = incoming?.preview.find((item) => item.id === INCOMING);
    if (!editable || !onDropNew || !incoming || !landed) return;
    event.preventDefault();
    onDropNew(incoming.widget.type, { x: landed.x, y: landed.y });
    setAnnouncement(`${incoming.widget.title} added: ${describe(landed)}`);
    setIncoming(null);
    endTrayDrag();
  };

  const ordered = wide ? shown : [...shown].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = gridHeight(shown);
  const shownRows = editable ? rows + SPARE_ROWS : rows;
  const dragged = drag ? shown.find((item) => item.id === drag.id) : undefined;
  const landing = drag?.mode === 'move' ? dragged : shown.find((item) => item.id === INCOMING);

  return (
    // While arranging, dragging never selects text on the page.
    <div className={cn('relative', editable && 'select-none')}>
      {/* Cells to drop into, under the blocks, only while arranging. */}
      {editable ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`, gridAutoRows: ROW_HEIGHT, gap: GAP }}
        >
          {Array.from({ length: GRID_COLUMNS * shownRows }, (_, index) => (
            <span key={index} className="rounded-lg bg-muted/60 ring-1 ring-border/40 ring-inset" />
          ))}
          {onDropNew ? (
            <span
              className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border-strong/70 bg-card/70 text-xs font-medium text-muted-foreground backdrop-blur-[1px]"
              style={{ gridColumn: '1 / -1', gridRow: `${rows + 2} / span ${SPARE_ROWS - 2}` }}
            >
              <PlusIcon className="size-3.5" /> Drag a widget here
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        ref={container}
        onPointerMove={track}
        onPointerUp={finish}
        onPointerCancel={finish}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
        className="relative grid"
        style={{
          gridTemplateColumns: wide ? `repeat(${GRID_COLUMNS}, minmax(0, 1fr))` : 'minmax(0, 1fr)',
          gridAutoRows: ROW_HEIGHT,
          gap: GAP,
          minHeight: wide ? shownRows * ROW_HEIGHT + Math.max(0, shownRows - 1) * GAP : undefined,
        }}
      >
        {/* Where the dragged block (or the widget from the tray) will land. */}
        {editable && landing ? (
          <div
            aria-hidden
            data-block-id="__landing"
            className="rounded-xl border-2 border-primary/60 bg-primary/10 shadow-[0_0_0_6px_color-mix(in_oklab,var(--primary)_12%,transparent),0_0_24px_color-mix(in_oklab,var(--primary)_25%,transparent)]"
            style={{ gridColumn: `${landing.x + 1} / span ${landing.w}`, gridRow: `${landing.y + 1} / span ${landing.h}` }}
          />
        ) : null}
        {ordered.map((item) => {
          if (item.id === INCOMING) return null;
          const moving = drag?.id === item.id && drag.mode === 'move';
          const resizing = drag?.id === item.id && drag.mode === 'resize';
          const pinned = fixed.has(item.id);
          const at = moving ? drag.origin : item;
          const title = titleOf(item);
          return (
            <div
              key={item.id}
              data-block-id={item.id}
              role={editable ? 'group' : undefined}
              aria-label={editable ? (pinned ? `${title} block, pinned by your workspace` : `${title} block, ${describe(item)}. Alt+arrows to move, Shift+Alt+arrows to resize, Delete to remove.`) : undefined}
              tabIndex={editable ? 0 : undefined}
              onKeyDown={(event) => onKey(event, item)}
              className={cn(
                'relative min-w-0 rounded-xl focus-visible:ring-[3px] focus-visible:ring-primary-soft focus-visible:outline-none [&>section]:h-full',
                editable && !pinned && 'transition-shadow duration-200 hover:shadow-md',
                moving && 'z-30 shadow-[0_24px_48px_-12px_rgb(0_0_0/0.28),0_8px_16px_-8px_rgb(0_0_0/0.18)]',
                resizing && 'z-20 ring-2 ring-primary/50',
              )}
              style={{
                gridColumn: wide ? `${at.x + 1} / span ${at.w}` : '1 / -1',
                gridRow: wide ? `${at.y + 1} / span ${at.h}` : `span ${item.h}`,
                // Lifted: it follows the pointer, a little bigger and tilted.
                transform: moving ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.03) rotate(-0.8deg)` : undefined,
                transition: moving && !reduced ? 'box-shadow 200ms ease' : undefined,
              }}
            >
              {renderBlock(item)}
              {/* A pinned block says so in its own header, and has no handles. */}
              {editable && !pinned ? (
                <>
                  {/* The whole block is the drag surface while arranging; the content underneath stays still. */}
                  <div
                    aria-hidden
                    onPointerDown={(event) => start(event, item, 'move')}
                    className={cn('absolute inset-0 rounded-xl', moving ? 'cursor-grabbing' : 'cursor-grab')}
                  />
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    aria-label={`Remove ${title}`}
                    className="absolute top-2 right-2 grid size-6 place-items-center rounded-md border bg-card text-muted-foreground shadow-xs transition-colors hover:border-destructive hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                  <div
                    aria-hidden
                    onPointerDown={(event) => start(event, item, 'resize')}
                    className="absolute -right-1 -bottom-1 size-3.5 cursor-se-resize rounded-[4px] border-2 border-card bg-ring transition-transform hover:scale-125"
                  />
                  {drag?.id === item.id ? (
                    <span className="pointer-events-none absolute bottom-2 left-3 rounded bg-card/90 px-1.5 font-mono text-[10.5px] text-muted-foreground">
                      {item.w}×{item.h}
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
        {/* The widget from the tray, as a ghost card at its landing spot. */}
        {editable && incoming ? (
          (() => {
            const ghost = shown.find((item) => item.id === INCOMING);
            return ghost ? (
              <div
                aria-hidden
                data-block-id={INCOMING}
                className="pointer-events-none z-20 flex items-start rounded-xl border bg-card/90 p-3 text-[13px] font-semibold shadow-[0_24px_48px_-12px_rgb(0_0_0/0.25)]"
                style={{ gridColumn: `${ghost.x + 1} / span ${ghost.w}`, gridRow: `${ghost.y + 1} / span ${ghost.h}`, transform: 'scale(1.02) rotate(-0.6deg)' }}
              >
                {incoming.widget.title}
              </div>
            ) : null;
          })()
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
