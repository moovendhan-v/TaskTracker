import { GRID_COLUMNS, type LayoutItem } from '@taskflow/shared-types';
import { XIcon } from 'lucide-react';
import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { gridHeight, moveItem, resizeItem } from '../lib/grid';

/** Height of one grid row and the gap between cells, in px. */
export const ROW_HEIGHT = 48;
export const GAP = 16;

const WIDE = '(min-width: 1024px)';
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(WIDE);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
/** The grid needs room for 12 columns; narrower screens stack the blocks instead. */
function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => true);
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
}

const describe = (item: LayoutItem) => `column ${item.x + 1}, row ${item.y + 1}, ${item.w} wide, ${item.h} tall`;

/**
 * Blocks on a 12-column grid (v2 "lego" layout). In arrange mode a block can be
 * dragged by any point, resized from its corner, removed with ×, or moved from
 * the keyboard: focus it, then ⌥+arrows moves and ⇧⌥+arrows resizes.
 */
export function BlockGrid({ items, arranging, onChange, onRemove, titleOf, renderBlock }: BlockGridProps) {
  const wide = useWideScreen();
  const container = useRef<HTMLDivElement>(null);
  const [dragState, setDrag] = useState<Drag | null>(null);
  const [previewState, setPreview] = useState<LayoutItem[] | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const editable = arranging && wide;
  // Leaving arrange mode mid-drag simply drops the drag.
  const drag = editable ? dragState : null;
  const preview = editable ? previewState : null;
  const shown = preview ?? items;

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
    setPreview(drag.mode === 'move' ? moveItem(drag.base, origin.id, origin.x + cols, origin.y + rows) : resizeItem(drag.base, origin.id, origin.w + cols, origin.h + rows));
  };

  const finish = () => {
    if (!drag) return;
    const placed = preview?.find((item) => item.id === drag.id);
    if (preview && placed && JSON.stringify(preview) !== JSON.stringify(drag.base)) {
      onChange(preview);
      setAnnouncement(`${titleOf(placed)} ${drag.mode === 'move' ? 'moved' : 'resized'}: ${describe(placed)}`);
    }
    setDrag(null);
    setPreview(null);
  };

  const onKey = (event: KeyboardEvent, item: LayoutItem) => {
    if (!editable) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && event.target === event.currentTarget) {
      event.preventDefault();
      onRemove(item);
      return;
    }
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!step || !event.altKey) return;
    event.preventDefault();
    const [dx, dy] = step as [number, number];
    const next = event.shiftKey ? resizeItem(items, item.id, item.w + dx, item.h + dy) : moveItem(items, item.id, item.x + dx, item.y + dy);
    const placed = next.find((other) => other.id === item.id)!;
    onChange(next);
    setAnnouncement(`${titleOf(item)}: ${describe(placed)}`);
  };

  const ordered = wide ? shown : [...shown].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = gridHeight(shown);
  const dragged = drag ? shown.find((item) => item.id === drag.id) : undefined;

  return (
    <div className="relative">
      <div
        ref={container}
        onPointerMove={track}
        onPointerUp={finish}
        onPointerCancel={finish}
        className={cn('grid', editable && 'rounded-xl bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:24px_24px] outline-2 outline-offset-8 outline-ring/60 outline-dashed')}
        style={{
          gridTemplateColumns: wide ? `repeat(${GRID_COLUMNS}, minmax(0, 1fr))` : 'minmax(0, 1fr)',
          gridAutoRows: ROW_HEIGHT,
          gap: GAP,
          minHeight: wide ? rows * ROW_HEIGHT + Math.max(0, rows - 1) * GAP : undefined,
        }}
      >
        {/* Where the dragged block will land. */}
        {drag?.mode === 'move' && dragged ? (
          <div
            aria-hidden
            className="rounded-xl border-2 border-dashed border-ring bg-primary-soft"
            style={{ gridColumn: `${dragged.x + 1} / span ${dragged.w}`, gridRow: `${dragged.y + 1} / span ${dragged.h}` }}
          />
        ) : null}
        {ordered.map((item) => {
          const moving = drag?.id === item.id && drag.mode === 'move';
          const at = moving ? drag.origin : item;
          const title = titleOf(item);
          return (
            <div
              key={item.id}
              role={editable ? 'group' : undefined}
              aria-label={editable ? `${title} block, ${describe(item)}. Alt+arrows to move, Shift+Alt+arrows to resize, Delete to remove.` : undefined}
              tabIndex={editable ? 0 : undefined}
              onKeyDown={(event) => onKey(event, item)}
              className={cn(
                'relative min-w-0 rounded-xl focus-visible:ring-[3px] focus-visible:ring-primary-soft focus-visible:outline-none [&>section]:h-full',
                moving && 'z-20 opacity-90 shadow-popover',
                drag && !moving && 'transition-[transform] duration-150',
              )}
              style={{
                gridColumn: wide ? `${at.x + 1} / span ${at.w}` : '1 / -1',
                gridRow: wide ? `${at.y + 1} / span ${at.h}` : `span ${item.h}`,
                transform: moving ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
              }}
            >
              {renderBlock(item)}
              {editable ? (
                <>
                  {/* The whole block is the drag surface while arranging; the content underneath stays still. */}
                  <div
                    aria-hidden
                    onPointerDown={(event) => start(event, item, 'move')}
                    className={cn('absolute inset-0 rounded-xl', moving ? 'cursor-grabbing' : 'cursor-grab')}
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(item)}
                    aria-label={`Remove ${title}`}
                    className="absolute top-2 right-2 grid size-6 place-items-center rounded-md border bg-card text-muted-foreground hover:border-destructive hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                  <div
                    aria-hidden
                    onPointerDown={(event) => start(event, item, 'resize')}
                    className="absolute -right-1 -bottom-1 size-3.5 cursor-se-resize rounded-[4px] border-2 border-card bg-ring"
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
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
