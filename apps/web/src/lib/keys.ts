/** Whether a key press is meant for a field the person is typing in. */
export function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** A menu, listbox or popover list is open: arrow keys belong to it. */
export function isMenuOpen(): boolean {
  return document.querySelector('[role="menu"],[role="listbox"]') !== null;
}

/** Plain single-key shortcuts only: no Ctrl/Cmd/Alt, and not while typing. */
export function isPlainShortcut(event: KeyboardEvent): boolean {
  return !event.metaKey && !event.ctrlKey && !event.altKey && !isEditable(event.target);
}

/** The index one step from `current` (−1 for none yet), kept inside the list. */
export function stepIndex(current: number, delta: 1 | -1, length: number): number {
  if (length === 0) return -1;
  if (current < 0) return delta === 1 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + delta));
}
