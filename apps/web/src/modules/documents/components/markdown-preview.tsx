import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

/**
 * Renders page markdown. Raw HTML in the source is never rendered (react-markdown
 * drops it; there is no rehype-raw), rehype-sanitize strips anything unexpected,
 * and unsafe URLs are removed by react-markdown's default URL transform.
 */
export function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  if (!content.trim()) return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
  return (
    <div className={cn('markdown', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" /> }}
      >
        {content}
      </Markdown>
    </div>
  );
}
