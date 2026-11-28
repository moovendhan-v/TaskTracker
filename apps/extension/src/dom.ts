/** Tiny DOM helper: `h('button', { class: 'primary', onclick }, 'Save')`. Text is always set as text, never HTML. */
type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2), value as EventListener);
    else if (key === 'class') element.className = String(value);
    else if (key === 'value' && 'value' in element) (element as HTMLInputElement).value = String(value);
    else if (key === 'checked' && 'checked' in element) (element as HTMLInputElement).checked = Boolean(value);
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) element.append(child);
  return element;
}

export function render(root: HTMLElement, ...children: Child[]): void {
  root.replaceChildren(...children.filter((child): child is Node | string => child !== null && child !== undefined && child !== false));
}
