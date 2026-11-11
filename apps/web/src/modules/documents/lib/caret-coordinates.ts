/** Styles that change where text wraps and sits, copied from the field to its measuring copy. */
const COPIED = [
  'boxSizing',
  'width',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
] as const;

export interface CaretPoint {
  /** From the field's outer top-left corner, before scrolling. */
  top: number;
  left: number;
  height: number;
}

/**
 * Where the caret at `index` is drawn in a textarea, measured with an invisible copy of the
 * field that wraps text the same way. One copy is reused per call batch: pass the same
 * `mirror` for several indexes, then remove it.
 */
export function caretPoint(field: HTMLTextAreaElement | HTMLInputElement, index: number, mirror: HTMLDivElement): CaretPoint {
  const style = window.getComputedStyle(field);
  const target = mirror.style as unknown as Record<string, string>;
  const source = style as unknown as Record<string, string>;
  for (const property of COPIED) target[property] = source[property] ?? '';
  const textarea = field.nodeName === 'TEXTAREA';
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.whiteSpace = textarea ? 'pre-wrap' : 'pre';
  mirror.style.overflowWrap = textarea ? 'break-word' : 'normal';
  mirror.style.overflow = 'hidden';
  // The visible field's text area excludes its scrollbar; the copy has none.
  if (textarea) mirror.style.width = `${field.clientWidth + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)}px`;

  const value = field.value;
  const at = Math.max(0, Math.min(index, value.length));
  mirror.textContent = value.slice(0, at);
  const marker = window.document.createElement('span');
  // Something after the caret keeps the marker on the right line when the text ends in a line break.
  // The rest of the word is enough to wrap it the same way.
  marker.textContent = /^\S*/.exec(value.slice(at))?.[0] || '.';
  mirror.appendChild(marker);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
  return {
    top: marker.offsetTop + parseFloat(style.borderTopWidth),
    left: marker.offsetLeft + parseFloat(style.borderLeftWidth),
    height: lineHeight,
  };
}

/** A person's colour: one of the categorical chart slots, the same for them everywhere. */
export function personColor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return `var(--chart-${(Math.abs(hash) % 6) + 1})`;
}
