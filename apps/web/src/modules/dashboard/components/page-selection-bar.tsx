import { LinkIcon, XIcon } from 'lucide-react';
import { usePageSelection } from '../lib/page-selection';

/** Says what's picked on the page, and clears it. Blocks set to follow the page narrow to it. */
export function PageSelectionBar() {
  const page = usePageSelection();
  if (!page?.selection) return null;
  const { selection } = page;
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary-soft px-3 py-2 text-sm">
      <LinkIcon aria-hidden className="size-4 text-ring" />
      <span>
        Showing <span className="font-semibold">{selection.name}</span> in blocks that follow the page
      </span>
      <button type="button" onClick={page.clear} className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium hover:bg-primary/15">
        <XIcon className="size-3.5" /> Clear selection
      </button>
    </div>
  );
}
