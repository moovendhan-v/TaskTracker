import { CHAT_USER_MENTION } from '@taskflow/shared-types';

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

const SKIP = new Set(['link', 'linkReference', 'inlineCode', 'code', 'definition', 'html']);

/** Fragment links survive the sanitizer; the renderer turns `#user-<id>` into a mention chip. */
export const USER_HREF_PREFIX = '#user-';

function transform(node: MdNode): void {
  if (!node.children || SKIP.has(node.type)) return;
  node.children = node.children.flatMap((child): MdNode[] => {
    if (child.type !== 'text' || !child.value) {
      transform(child);
      return [child];
    }
    const parts: MdNode[] = [];
    let last = 0;
    for (const match of child.value.matchAll(new RegExp(CHAT_USER_MENTION.source, 'g'))) {
      const start = match.index ?? 0;
      if (start > last) parts.push({ type: 'text', value: child.value.slice(last, start) });
      parts.push({ type: 'link', url: `${USER_HREF_PREFIX}${match[1]}`, children: [{ type: 'text', value: '@' }] });
      last = start + match[0].length;
    }
    if (parts.length === 0) return [child];
    if (last < child.value.length) parts.push({ type: 'text', value: child.value.slice(last) });
    return parts;
  });
}

/** remark plugin: `@{userId}` (how chat stores a mention) becomes a person reference. */
export function remarkUserMentions() {
  return (tree: MdNode) => transform(tree);
}
