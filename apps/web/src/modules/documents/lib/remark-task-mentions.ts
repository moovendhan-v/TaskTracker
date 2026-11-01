import { splitMentions } from './task-embeds';

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

/** Links and code keep their text as written. */
const SKIP = new Set(['link', 'linkReference', 'inlineCode', 'code', 'definition', 'html']);

/** Fragment links are the one href form the sanitizer keeps untouched; the renderer turns them into chips. */
export const TASK_HREF_PREFIX = '#task-';

function transform(node: MdNode): void {
  if (!node.children || SKIP.has(node.type)) return;
  node.children = node.children.flatMap((child) => {
    if (child.type !== 'text' || !child.value) {
      transform(child);
      return [child];
    }
    const parts = splitMentions(child.value);
    if (parts.length === 1 && parts[0]!.type === 'text') return [child];
    return parts.map((part): MdNode =>
      part.type === 'text' ? { type: 'text', value: part.value } : { type: 'link', url: `${TASK_HREF_PREFIX}${part.number}`, children: [{ type: 'text', value: `#${part.number}` }] },
    );
  });
}

/** remark plugin: `#123` in running text becomes a task reference. */
export function remarkTaskMentions() {
  return (tree: MdNode) => transform(tree);
}
