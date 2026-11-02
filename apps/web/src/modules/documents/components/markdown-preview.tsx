import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';
import { remarkTaskMentions, TASK_HREF_PREFIX } from '../lib/remark-task-mentions';
import { remarkUserMentions, USER_HREF_PREFIX } from '../lib/remark-user-mentions';
import { parseTaskEmbed, type TaskEmbed } from '../lib/task-embeds';
import { TaskChip, TaskEmbedCard, TaskListEmbed, UserMention } from './task-embeds';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

interface StatItem {
  value: string;
  label: string;
  desc?: string;
}

interface CardItem {
  icon: string;
  title: string;
  desc: string;
}

interface TimelineItem {
  time: string;
  title: string;
  desc: string;
}

type Chunk =
  | { type: 'markdown'; content: string }
  | { type: 'cards'; cols: number; items: CardItem[] }
  | { type: 'stats'; cols: number; items: StatItem[] }
  | { type: 'timeline'; items: TimelineItem[] }
  | { type: 'task-embed'; embed: TaskEmbed };

/**
 * Parses md2slides custom container extensions (:::cards, :::stats, :::timeline)
 */
function parseMd2SlidesContainers(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = text.split('\n');
  let currentMdLines: string[] = [];
  let i = 0;

  const flushMd = () => {
    if (currentMdLines.length > 0) {
      chunks.push({ type: 'markdown', content: currentMdLines.join('\n') });
      currentMdLines = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) {
      i++;
      continue;
    }

    // :::task 12 / :::tasks overdue limit=5 (live task references)
    const embed = line.startsWith(':::task') ? parseTaskEmbed(line) : null;
    if (embed) {
      flushMd();
      i++;
      // The block's body is empty; skip anything up to its closing ':::'.
      while (i < lines.length && !(lines[i] ?? '').startsWith(':::')) i++;
      i++;
      chunks.push({ type: 'task-embed', embed });
      continue;
    }

    // :::cards
    if (line.startsWith(':::cards')) {
      flushMd();
      const colMatch = line.match(/cols=(\d+)/);
      const cols = colMatch && colMatch[1] ? Number(colMatch[1]) : 3;
      i++;
      const items: CardItem[] = [];
      while (i < lines.length) {
        const cl = lines[i];
        if (cl === undefined || cl.startsWith(':::')) break;
        const trimmed = cl.trim();
        if (trimmed.startsWith('-')) {
          const raw = trimmed.slice(1).trim();
          const parts = raw.split('|').map((s) => s.trim());
          const firstPart = parts[0] ?? 'Item';
          const iconMatch = firstPart.match(/^(\p{Emoji}|\S+)\s+(.+)$/u);
          const icon = iconMatch && iconMatch[1] ? iconMatch[1] : '✨';
          const title = iconMatch && iconMatch[2] ? iconMatch[2] : firstPart;
          const desc = parts[1] ?? '';
          items.push({ icon, title, desc });
        }
        i++;
      }
      i++; // skip ':::'
      chunks.push({ type: 'cards', cols, items });
      continue;
    }

    // :::stats
    if (line.startsWith(':::stats')) {
      flushMd();
      const colMatch = line.match(/cols=(\d+)/);
      const cols = colMatch && colMatch[1] ? Number(colMatch[1]) : 3;
      i++;
      const items: StatItem[] = [];
      while (i < lines.length) {
        const sl = lines[i];
        if (sl === undefined || sl.startsWith(':::')) break;
        const trimmed = sl.trim();
        if (trimmed.startsWith('-')) {
          const raw = trimmed.slice(1).trim();
          const parts = raw.split('|').map((s) => s.trim());
          const value = parts[0] ?? '100%';
          const label = parts[1] ?? 'Metric';
          const desc = parts[2] ?? '';
          items.push({ value, label, desc });
        }
        i++;
      }
      i++; // skip ':::'
      chunks.push({ type: 'stats', cols, items });
      continue;
    }

    // :::timeline
    if (line.startsWith(':::timeline')) {
      flushMd();
      i++;
      const items: TimelineItem[] = [];
      while (i < lines.length) {
        const tl = lines[i];
        if (tl === undefined || tl.startsWith(':::')) break;
        const trimmed = tl.trim();
        if (trimmed.startsWith('-')) {
          const raw = trimmed.slice(1).trim();
          const parts = raw.split('|').map((s) => s.trim());
          const time = parts[0] ?? 'Q1';
          const title = parts[1] ?? 'Milestone';
          const desc = parts[2] ?? '';
          items.push({ time, title, desc });
        }
        i++;
      }
      i++; // skip ':::'
      chunks.push({ type: 'timeline', items });
      continue;
    }

    currentMdLines.push(line);
    i++;
  }

  flushMd();
  return chunks;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  if (!content.trim()) return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;

  const chunks = parseMd2SlidesContainers(content);

  return (
    <div className={cn('markdown flex flex-col gap-4', className)}>
      {chunks.map((chunk, idx) => {
        if (chunk.type === 'markdown') {
          return (
            <Markdown
              key={idx}
              remarkPlugins={[remarkGfm, remarkTaskMentions, remarkUserMentions]}
              rehypePlugins={[rehypeSanitize]}
              components={{
                a: ({ node: _node, ...props }) => {
                  const number = props.href?.startsWith(TASK_HREF_PREFIX) ? Number(props.href.slice(TASK_HREF_PREFIX.length)) : NaN;
                  if (Number.isInteger(number) && number > 0) return <TaskChip number={number} />;
                  if (props.href?.startsWith(USER_HREF_PREFIX)) return <UserMention userId={props.href.slice(USER_HREF_PREFIX.length)} />;
                  return <a {...props} target="_blank" rel="noopener noreferrer nofollow" />;
                },
              }}
            >
              {chunk.content}
            </Markdown>
          );
        }

        if (chunk.type === 'task-embed') {
          return chunk.embed.kind === 'task' ? <TaskEmbedCard key={idx} number={chunk.embed.number} /> : <TaskListEmbed key={idx} preset={chunk.embed.preset} limit={chunk.embed.limit} />;
        }

        if (chunk.type === 'cards') {
          const gridCols =
            chunk.cols === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : chunk.cols === 4
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';

          return (
            <div key={idx} className={cn('my-4 grid gap-3.5 not-prose', gridCols)}>
              {chunk.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card/60 p-4.5 shadow-sm backdrop-blur transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-lg">
                      {item.icon}
                    </span>
                    <h4 className="font-semibold text-foreground text-sm tracking-tight">{item.title}</h4>
                  </div>
                  {item.desc ? <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">{item.desc}</p> : null}
                </div>
              ))}
            </div>
          );
        }

        if (chunk.type === 'stats') {
          const gridCols =
            chunk.cols === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : chunk.cols === 4
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
              : 'grid-cols-1 sm:grid-cols-3';

          return (
            <div key={idx} className={cn('my-4 grid gap-3.5 not-prose', gridCols)}>
              {chunk.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className="rounded-xl border border-primary/20 bg-gradient-to-br from-card/80 to-primary/5 p-5 shadow-sm backdrop-blur"
                >
                  <div className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">{item.value}</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{item.label}</div>
                  {item.desc ? <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p> : null}
                </div>
              ))}
            </div>
          );
        }

        if (chunk.type === 'timeline') {
          return (
            <div key={idx} className="my-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-card/40 p-4.5 not-prose">
              {chunk.items.map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-start gap-3.5">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {item.time}
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-semibold text-foreground">{item.title}</h5>
                    {item.desc ? <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
