import { cssSelector, describeElement } from './element.js';

export interface PickedElement {
  selector: string;
  description: string;
  /** Position in the viewport when picked, for highlighting it on a screenshot. */
  rect: { x: number; y: number; width: number; height: number };
}

/**
 * Lets the reporter point at the broken element: a highlight follows the pointer, a click picks,
 * Escape cancels. Clicks while picking never reach the page.
 */
export function pickElement(options: { ignoreAttribute?: string } = {}): Promise<PickedElement | null> {
  const ignore = options.ignoreAttribute ?? 'data-bug-capture-ignore';
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.setAttribute(ignore, '');
    Object.assign(box.style, {
      position: 'fixed',
      zIndex: '2147483647',
      pointerEvents: 'none',
      border: '2px solid #e5484d',
      background: 'rgba(229, 72, 77, 0.12)',
      borderRadius: '3px',
      transition: 'all 60ms ease-out',
      display: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    const hint = document.createElement('div');
    hint.setAttribute(ignore, '');
    hint.textContent = 'Click the element with the problem · Esc to cancel';
    Object.assign(hint.style, {
      position: 'fixed',
      zIndex: '2147483647',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      pointerEvents: 'none',
      padding: '6px 12px',
      borderRadius: '6px',
      background: '#111',
      color: '#fff',
      font: '13px system-ui, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,.25)',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.append(box, hint);
    let current: Element | null = null;

    const target = (event: MouseEvent): Element | null => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      return element && !element.closest(`[${ignore}]`) ? element : null;
    };
    const onMove = (event: MouseEvent) => {
      current = target(event);
      if (!current) {
        box.style.display = 'none';
        return;
      }
      const rect = current.getBoundingClientRect();
      Object.assign(box.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    };
    const block = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const finish = (picked: PickedElement | null) => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('mousedown', block, true);
      document.removeEventListener('mouseup', block, true);
      document.removeEventListener('keydown', onKey, true);
      box.remove();
      hint.remove();
      resolve(picked);
    };
    const onClick = (event: MouseEvent) => {
      block(event);
      const element = target(event) ?? current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      finish({ selector: cssSelector(element), description: describeElement(element), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      block(event);
      finish(null);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('mousedown', block, true);
    document.addEventListener('mouseup', block, true);
    document.addEventListener('keydown', onKey, true);
  });
}
