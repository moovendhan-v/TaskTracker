import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import type { LiveField, LivePeerView } from '../live/live-doc';
import { caretPoint, personColor, type CaretPoint } from '../lib/caret-coordinates';

interface PlacedCaret extends CaretPoint {
  key: number;
  name: string;
  color: string;
}

/**
 * Other people's cursors in a text field (C5): a coloured caret with their name where each
 * person's cursor is, kept in place as the text changes and the field scrolls or resizes.
 * Positions come from the shared document, so they're exact, not per line.
 */
export function RemoteCarets({ fieldRef, field, peers, value }: { fieldRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>; field: LiveField; peers: readonly LivePeerView[]; value: string }) {
  const [carets, setCarets] = useState<PlacedCaret[]>([]);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [size, setSize] = useState(0);
  const here = peers.filter((peer) => peer.field === field && peer.head !== null);
  const signature = here.map((peer) => `${peer.clientId}:${peer.head}`).join(',');

  useLayoutEffect(() => {
    const element = fieldRef.current;
    if (!element || !here.length) {
      setCarets([]);
      return;
    }
    const mirror = window.document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    window.document.body.appendChild(mirror);
    try {
      setCarets(here.map((peer) => ({ key: peer.clientId, name: peer.name, color: personColor(peer.id), ...caretPoint(element, peer.head!, mirror) })));
    } finally {
      mirror.remove();
    }
    // `here` follows `signature`; the field's text and width change where carets are drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldRef, signature, value, size]);

  useEffect(() => {
    const element = fieldRef.current;
    if (!element) return;
    const onScroll = () => setScroll({ top: element.scrollTop, left: element.scrollLeft });
    element.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(() => setSize(element.clientWidth));
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [fieldRef]);

  if (!carets.length) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" data-testid={`remote-carets-${field}`}>
      {carets.map((caret) => (
        <span
          key={caret.key}
          className="absolute w-0.5 rounded-full transition-[top,left] duration-75"
          style={{ top: caret.top - scroll.top, left: caret.left - scroll.left, height: caret.height, background: caret.color }}
          data-name={caret.name}
        >
          <span className="absolute bottom-full left-0 whitespace-nowrap rounded-sm px-1 py-px text-[10px] font-medium leading-tight text-white" style={{ background: caret.color }}>
            {caret.name}
          </span>
        </span>
      ))}
    </div>
  );
}
