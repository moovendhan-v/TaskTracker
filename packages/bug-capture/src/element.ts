/** A short readable name for an element: its label, accessible name or text. Never a field's value. */
export function describeElement(element: Element): string {
  const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const aria = clean(element.getAttribute('aria-label'));
  if (aria) return aria;
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = clean(labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' '));
    if (text) return text;
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const label = clean(element.labels?.[0]?.textContent);
    if (label) return label;
    const placeholder = clean('placeholder' in element ? element.placeholder : '');
    if (placeholder) return placeholder;
    if (element.name) return clean(element.name);
    return element instanceof HTMLInputElement ? `${element.type} field` : element.tagName.toLowerCase();
  }
  const title = clean(element.getAttribute('title'));
  if (title) return title;
  const text = clean((element as HTMLElement).innerText ?? element.textContent);
  if (text) return text;
  const alt = clean(element.getAttribute('alt'));
  if (alt) return alt;
  const role = element.getAttribute('role');
  return role ?? element.tagName.toLowerCase();
}

const GENERATED_ID = /^(radix-|:r|react-|ember|ext-gen)|\d{4,}|[0-9a-f]{8}-/i;

function escape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

/** A CSS selector for developers: a stable id or test id when there is one, else a short path. */
export function cssSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  for (let depth = 0; current && current !== document.documentElement && depth < 5; depth += 1) {
    const testId = current.getAttribute('data-testid');
    if (testId) {
      parts.unshift(`[data-testid="${testId.replace(/"/g, '\\"').slice(0, 60)}"]`);
      break;
    }
    if (current.id && !GENERATED_ID.test(current.id)) {
      parts.unshift(`#${escape(current.id)}`);
      break;
    }
    let part = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter((child) => child.tagName === current!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    current = parent;
  }
  return parts.join(' > ').slice(0, 300);
}
