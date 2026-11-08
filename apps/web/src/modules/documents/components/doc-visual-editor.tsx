import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CodeIcon,
  Columns2Icon,
  CopyIcon,
  FilmIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  InfoIcon,
  LightbulbIcon,
  PlusIcon,
  PresentationIcon,
  SparklesIcon,
  TableIcon,
  Trash2Icon,
  ListChecksIcon,
  TicketIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { parseTaskEmbed, TASK_LIST_LABELS, TASK_LIST_LIMIT, TASK_LIST_PRESETS, taskEmbedToMarkdown, type TaskListPreset } from '../lib/task-embeds';
import { TaskEmbedCard, TaskListEmbed, TaskMentionTextarea } from './task-embeds';

export type BlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'paragraph'
  | 'table'
  | 'checklist'
  | 'callout'
  | 'code'
  | 'cards'
  | 'stats'
  | 'timeline'
  | 'task'
  | 'tasks'
  | 'divider';

export interface VisualBlock {
  id: string;
  type: BlockType;
  content: string; // Used for headings, paragraphs, code, divider
  meta?: {
    // For tables
    headers?: string[];
    rows?: string[][];
    // For checklists
    items?: { id: string; text: string; checked: boolean }[];
    // For callout
    calloutType?: 'note' | 'tip' | 'warning';
    // For code
    language?: string;
    // For cards
    cols?: number;
    cardItems?: { id: string; icon: string; title: string; desc: string }[];
    // For stats
    statItems?: { id: string; value: string; label: string; desc: string }[];
    // For timeline
    timelineItems?: { id: string; time: string; title: string; desc: string }[];
    // For task embeds (:::task 12 / :::tasks overdue limit=5)
    taskNumber?: number | null;
    taskPreset?: TaskListPreset;
    taskLimit?: number;
  };
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// Convert markdown to blocks
export function markdownToBlocks(md: string): VisualBlock[] {
  if (!md.trim()) {
    return [
      { id: uid(), type: 'h1', content: 'Overview' },
      { id: uid(), type: 'paragraph', content: 'Start typing here or choose an md2slides component below.' },
    ];
  }

  const lines = md.split('\n');
  const blocks: VisualBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) {
      i++;
      continue;
    }

    // Check for divider
    if (/^---\s*$/.test(line)) {
      blocks.push({ id: uid(), type: 'divider', content: '---' });
      i++;
      continue;
    }

    // Task references: :::task 12 / :::tasks overdue limit=5 (body is empty)
    const embed = line.startsWith(':::task') ? parseTaskEmbed(line) : null;
    if (embed) {
      blocks.push(
        embed.kind === 'task'
          ? { id: uid(), type: 'task', content: '', meta: { taskNumber: embed.number } }
          : { id: uid(), type: 'tasks', content: '', meta: { taskPreset: embed.preset, taskLimit: embed.limit } },
      );
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith(':::')) i++;
      i++;
      continue;
    }

    // Check for cards block :::cards cols=3
    if (line.startsWith(':::cards')) {
      const colMatch = line.match(/cols=(\d+)/);
      const cols = colMatch && colMatch[1] ? Number(colMatch[1]) : 3;
      i++;
      const cardItems: { id: string; icon: string; title: string; desc: string }[] = [];
      while (i < lines.length) {
        const nextL = lines[i];
        if (nextL === undefined || nextL.startsWith(':::')) break;
        const cl = nextL.trim();
        if (cl.startsWith('-')) {
          const raw = cl.slice(1).trim();
          const parts = raw.split('|').map((s) => s.trim());
          const firstPart = parts[0] ?? 'Feature';
          const iconMatch = firstPart.match(/^(\p{Emoji}|\S+)\s+(.+)$/u);
          const icon = iconMatch && iconMatch[1] ? iconMatch[1] : '✨';
          const title = iconMatch && iconMatch[2] ? iconMatch[2] : firstPart;
          const desc = parts[1] ?? '';
          cardItems.push({ id: uid(), icon, title, desc });
        }
        i++;
      }
      i++; // skip ':::'
      blocks.push({ id: uid(), type: 'cards', content: '', meta: { cols, cardItems } });
      continue;
    }

    // Check for stats block :::stats cols=3
    if (line.startsWith(':::stats')) {
      const colMatch = line.match(/cols=(\d+)/);
      const cols = colMatch && colMatch[1] ? Number(colMatch[1]) : 3;
      i++;
      const statItems: { id: string; value: string; label: string; desc: string }[] = [];
      while (i < lines.length) {
        const nextL = lines[i];
        if (nextL === undefined || nextL.startsWith(':::')) break;
        const sl = nextL.trim();
        if (sl.startsWith('-')) {
          const raw = sl.slice(1).trim();
          const parts = raw.split('|').map((s) => s.trim());
          const value = parts[0] ?? '100%';
          const label = parts[1] ?? 'Metric';
          const desc = parts[2] ?? '';
          statItems.push({ id: uid(), value, label, desc });
        }
        i++;
      }
      i++; // skip ':::'
      blocks.push({ id: uid(), type: 'stats', content: '', meta: { cols, statItems } });
      continue;
    }

    // Check for timeline block :::timeline
    if (line.startsWith(':::timeline')) {
      i++;
      const timelineItems: { id: string; time: string; title: string; desc: string }[] = [];
      while (i < lines.length) {
        const nextL = lines[i];
        if (nextL === undefined || nextL.startsWith(':::')) break;
        const tl = nextL.trim();
        if (tl.startsWith('-')) {
          const raw = tl.slice(1).trim();
          const parts = raw.split('|').map((s) => s.trim());
          const time = parts[0] ?? 'Q1';
          const title = parts[1] ?? 'Milestone';
          const desc = parts[2] ?? '';
          timelineItems.push({ id: uid(), time, title, desc });
        }
        i++;
      }
      i++; // skip ':::'
      blocks.push({ id: uid(), type: 'timeline', content: '', meta: { timelineItems } });
      continue;
    }

    // Check for code block ```lang
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || 'typescript';
      i++;
      const codeLines: string[] = [];
      while (i < lines.length) {
        const nextL = lines[i];
        if (nextL === undefined || nextL.startsWith('```')) break;
        codeLines.push(nextL);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ id: uid(), type: 'code', content: codeLines.join('\n'), meta: { language } });
      continue;
    }

    // Check for callout > [!NOTE]
    if (line.startsWith('> [!')) {
      const typeMatch = line.match(/>\s*\[!(NOTE|TIP|WARNING)\]/i);
      const calloutType = (typeMatch && typeMatch[1] ? typeMatch[1].toLowerCase() : 'note') as 'note' | 'tip' | 'warning';
      i++;
      const textLines: string[] = [];
      while (i < lines.length) {
        const nextL = lines[i];
        if (nextL === undefined || !nextL.startsWith('>')) break;
        textLines.push(nextL.replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ id: uid(), type: 'callout', content: textLines.join('\n'), meta: { calloutType } });
      continue;
    }

    // Check for table | col1 | col2 |
    if (line.trim().startsWith('|') && line.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length) {
        const nextL = lines[i];
        if (nextL === undefined || !nextL.trim().startsWith('|')) break;
        tableLines.push(nextL);
        i++;
      }
      if (tableLines.length >= 2) {
        const firstLine = tableLines[0] ?? '';
        const headers = firstLine
          .split('|')
          .slice(1, -1)
          .map((s) => s.trim());
        const dataLines = tableLines.slice(2); // skip separator row
        const rows = dataLines.map((r) =>
          r
            .split('|')
            .slice(1, -1)
            .map((s) => s.trim())
        );
        blocks.push({ id: uid(), type: 'table', content: '', meta: { headers, rows } });
        continue;
      }
    }

    // Check for checklist items - [ ] or - [x]
    if (/^-\s*\[([ xX])\]\s+/.test(line)) {
      const items: { id: string; text: string; checked: boolean }[] = [];
      while (i < lines.length) {
        const nextL = lines[i];
        if (nextL === undefined || !/^-\s*\[([ xX])\]\s+/.test(nextL)) break;
        const match = nextL.match(/^-\s*\[([ xX])\]\s+(.*)$/);
        if (match && match[1]) {
          items.push({ id: uid(), checked: match[1].toLowerCase() === 'x', text: match[2] ?? '' });
        }
        i++;
      }
      blocks.push({ id: uid(), type: 'checklist', content: '', meta: { items } });
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      blocks.push({ id: uid(), type: 'h1', content: line.slice(2).trim() });
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ id: uid(), type: 'h2', content: line.slice(3).trim() });
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push({ id: uid(), type: 'h3', content: line.slice(4).trim() });
      i++;
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
    const pLines: string[] = [];
    while (i < lines.length) {
      const nextL = lines[i];
      if (
        nextL === undefined ||
        !nextL.trim() ||
        nextL.startsWith('#') ||
        nextL.startsWith('---') ||
        nextL.startsWith(':::') ||
        nextL.startsWith('```') ||
        nextL.startsWith('> [!') ||
        nextL.trim().startsWith('|') ||
        /^-\s*\[[ xX]\]/.test(nextL)
      ) {
        break;
      }
      pLines.push(nextL);
      i++;
    }
    blocks.push({ id: uid(), type: 'paragraph', content: pLines.join('\n') });
  }

  return blocks.length > 0
    ? blocks
    : [
        { id: uid(), type: 'h1', content: 'Overview' },
        { id: uid(), type: 'paragraph', content: '' },
      ];
}

// Serialize blocks to markdown
export function blocksToMarkdown(blocks: VisualBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'h1':
          return `# ${b.content.trim()}`;
        case 'h2':
          return `## ${b.content.trim()}`;
        case 'h3':
          return `### ${b.content.trim()}`;
        case 'paragraph':
          return b.content.trim();
        case 'divider':
          return '---';
        case 'callout': {
          const type = (b.meta?.calloutType || 'note').toUpperCase();
          const text = b.content.trim() || 'Important note';
          return `> [!${type}]\n> ${text.replace(/\n/g, '\n> ')}`;
        }
        case 'code':
          return `\`\`\`${b.meta?.language || 'typescript'}\n${b.content}\n\`\`\``;
        case 'checklist': {
          const items = b.meta?.items || [];
          return items.map((it) => `- [${it.checked ? 'x' : ' '}] ${it.text.trim()}`).join('\n');
        }
        case 'table': {
          const headers = b.meta?.headers || ['Column 1', 'Column 2'];
          const rows = b.meta?.rows || [];
          const headerLine = `| ${headers.join(' | ')} |`;
          const sepLine = `| ${headers.map(() => '---').join(' | ')} |`;
          const rowLines = rows.map((r) => `| ${headers.map((_, idx) => r[idx] ?? '').join(' | ')} |`);
          return [headerLine, sepLine, ...rowLines].join('\n');
        }
        case 'cards': {
          const cols = b.meta?.cols || 3;
          const items = b.meta?.cardItems || [];
          const cardLines = items.map((it) => `- ${it.icon} ${it.title} | ${it.desc}`);
          return [`:::cards cols=${cols}`, ...cardLines, ':::'].join('\n');
        }
        case 'stats': {
          const cols = b.meta?.cols || 3;
          const items = b.meta?.statItems || [];
          const statLines = items.map((it) => `- ${it.value} | ${it.label} | ${it.desc}`);
          return [`:::stats cols=${cols}`, ...statLines, ':::'].join('\n');
        }
        case 'task':
          // An unfinished card (no number yet) is left out rather than saved broken.
          return b.meta?.taskNumber ? taskEmbedToMarkdown({ kind: 'task', number: b.meta.taskNumber }) : '';
        case 'tasks':
          return taskEmbedToMarkdown({ kind: 'tasks', preset: b.meta?.taskPreset ?? 'open', limit: b.meta?.taskLimit ?? TASK_LIST_LIMIT.default });
        case 'timeline': {
          const items = b.meta?.timelineItems || [];
          const timelineLines = items.map((it) => `- ${it.time} | ${it.title} | ${it.desc}`);
          return [`:::timeline`, ...timelineLines, ':::'].join('\n');
        }
        default:
          return b.content;
      }
    })
    .filter((s) => s.trim().length > 0)
    .join('\n\n');
}

interface DocVisualEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  canEdit: boolean;
}

export function DocVisualEditor({ initialMarkdown, onChange, canEdit }: DocVisualEditorProps) {
  const [blocks, setBlocks] = useState<VisualBlock[]>(() => markdownToBlocks(initialMarkdown));
  const isInternalChange = useRef(false);
  // The latest blocks, so an update can tell the parent outside of React's render phase
  // (calling onChange inside a setState updater updates DocEditor while this one renders).
  const latest = useRef(blocks);
  // The markdown this editor last produced, to tell its own changes from someone else's (C5).
  const emitted = useRef(initialMarkdown);

  const updateBlocks = useCallback(
    (updater: (prev: VisualBlock[]) => VisualBlock[]) => {
      const next = updater(latest.current);
      if (next === latest.current) return;
      latest.current = next;
      isInternalChange.current = true;
      setBlocks(next);
      const markdown = blocksToMarkdown(next);
      emitted.current = markdown;
      onChange(markdown);
    },
    [onChange]
  );

  // Someone else changed the page (live editing): show their version. Blocks keep their
  // ids by position when the type is unchanged, so the one you're typing in keeps focus.
  useEffect(() => {
    if (initialMarkdown === emitted.current) return;
    emitted.current = initialMarkdown;
    const previous = latest.current;
    const next = markdownToBlocks(initialMarkdown).map((block, index) => {
      const before = previous[index];
      return before && before.type === block.type ? { ...block, id: before.id } : block;
    });
    latest.current = next;
    setBlocks(next);
  }, [initialMarkdown]);

  const updateBlock = (id: string, partial: Partial<VisualBlock>) => {
    updateBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...partial } : b)));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    updateBlocks((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const source = copy[index];
      const target = copy[targetIndex];
      if (source && target) {
        copy[index] = target;
        copy[targetIndex] = source;
      }
      return copy;
    });
  };

  const deleteBlock = (id: string) => {
    updateBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const insertBlockAfter = (index: number, type: BlockType) => {
    const newBlock: VisualBlock = createDefaultBlock(type);
    updateBlocks((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, newBlock);
      return copy;
    });
  };

  // Insert full md2slides template
  const insertFullSlidesTemplate = () => {
    const templateBlocks: VisualBlock[] = [
      { id: uid(), type: 'h1', content: 'Product Strategy & Vision' },
      { id: uid(), type: 'paragraph', content: 'Key initiatives and architectural milestones for modern teams.' },
      { id: uid(), type: 'divider', content: '---' },
      { id: uid(), type: 'h2', content: 'Key Metrics & Growth' },
      createDefaultBlock('stats'),
      { id: uid(), type: 'divider', content: '---' },
      { id: uid(), type: 'h2', content: 'Core Value Pillars' },
      createDefaultBlock('cards'),
      { id: uid(), type: 'divider', content: '---' },
      { id: uid(), type: 'h2', content: 'Delivery Roadmap' },
      createDefaultBlock('timeline'),
    ];
    updateBlocks(() => templateBlocks);
  };

  // Compute slide index for dividers
  let currentSlideCount = 1;

  return (
    <div className="flex flex-col gap-3 py-4">
      {/* md2slides Template Banner (for empty or new documents) */}
      {blocks.length <= 2 && canEdit ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card p-3.5 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <PresentationIcon className="size-4 text-primary" />
            <div>
              <div className="text-xs font-semibold text-foreground">Turn this document into an md2slides presentation?</div>
              <div className="text-[11px] text-muted-foreground">Pre-loads cards grids, KPI stats, and roadmap timeline.</div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={insertFullSlidesTemplate} className="h-7 gap-1 text-xs text-primary border-primary/30 hover:bg-primary/20">
            <SparklesIcon className="size-3" />
            <span>Load Slide Deck</span>
          </Button>
        </div>
      ) : null}

      {blocks.map((block, idx) => {
        let slideHeader = null;
        if (block.type === 'divider') {
          currentSlideCount++;
          slideHeader = `Slide ${currentSlideCount}`;
        }

        return (
          <div
            key={block.id}
            className="group relative flex items-start gap-2 rounded-lg border border-transparent p-1 transition-all hover:border-slate-800 hover:bg-card/40"
          >
            {/* Left Block Controls (hover) */}
            {canEdit ? (
              <div className="mt-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => moveBlock(idx, 'up')}
                  disabled={idx === 0}
                  title="Move up"
                >
                  <ChevronUpIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => moveBlock(idx, 'down')}
                  disabled={idx === blocks.length - 1}
                  title="Move down"
                >
                  <ChevronDownIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-muted-foreground hover:text-critical"
                  onClick={() => deleteBlock(block.id)}
                  title="Delete block"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            ) : null}

            {/* Block Content Render */}
            <div className="min-w-0 flex-1">
              <BlockRenderer
                block={block}
                slideTitle={slideHeader}
                canEdit={canEdit}
                onChange={(updated) => updateBlock(block.id, updated)}
              />
            </div>

            {/* Quick Insert Dropdown (Between Blocks) */}
            {canEdit ? (
              <div className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="size-6 text-primary hover:bg-primary/10" title="Add block below">
                      <PlusIcon className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-[11px] text-muted-foreground">General</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'paragraph')}>Paragraph</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'h2')}>Heading 2</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'table')}>Table</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'checklist')}>Checklist</DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[11px] text-primary font-semibold flex items-center gap-1">
                      <PresentationIcon className="size-3" /> md2slides Syntax
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'divider')}>
                      <FilmIcon className="size-3.5 mr-2 text-primary" />
                      <span>New Slide (---)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'cards')}>
                      <Columns2Icon className="size-3.5 mr-2 text-accent" />
                      <span>Cards Grid (:::cards)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'stats')}>
                      <ActivityIcon className="size-3.5 mr-2 text-good" />
                      <span>KPI Stats (:::stats)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'timeline')}>
                      <ClockIcon className="size-3.5 mr-2 text-warning" />
                      <span>Roadmap (:::timeline)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'code')}>
                      <CodeIcon className="size-3.5 mr-2 text-critical" />
                      <span>Code Block</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[11px] font-semibold">Tasks</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'task')}>
                      <TicketIcon className="size-3.5 mr-2" />
                      <span>Task card</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlockAfter(idx, 'tasks')}>
                      <ListChecksIcon className="size-3.5 mr-2" />
                      <span>Live task list</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Bottom Inserter Button */}
      {canEdit ? (
        <div className="mt-4 flex items-center justify-center gap-2 border-t border-dashed border-border/50 pt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <PlusIcon className="size-3.5 text-primary" />
                <span>Add component / slide block</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Standard Content</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'paragraph')}>
                <span>Text Paragraph</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'h1')}>
                <Heading1Icon className="size-4 mr-2 text-chart-1" />
                <span>Heading 1</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'h2')}>
                <Heading2Icon className="size-4 mr-2 text-chart-1" />
                <span>Heading 2</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'h3')}>
                <Heading3Icon className="size-4 mr-2 text-chart-1" />
                <span>Heading 3</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'table')}>
                <TableIcon className="size-4 mr-2 text-good" />
                <span>Interactive Table</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'checklist')}>
                <CheckSquareIcon className="size-4 mr-2 text-primary" />
                <span>Task Checklist</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'callout')}>
                <InfoIcon className="size-4 mr-2 text-warning" />
                <span>Callout Box</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] text-primary font-semibold flex items-center gap-1">
                <PresentationIcon className="size-3" /> md2slides Presentation Syntax
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'divider')}>
                <FilmIcon className="size-4 mr-2 text-primary" />
                <span>Slide Split (---)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'cards')}>
                <Columns2Icon className="size-4 mr-2 text-accent" />
                <span>Cards Grid (:::cards cols=3)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'stats')}>
                <ActivityIcon className="size-4 mr-2 text-good" />
                <span>KPI Metrics (:::stats cols=3)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'timeline')}>
                <ClockIcon className="size-4 mr-2 text-warning" />
                <span>Roadmap Timeline (:::timeline)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'code')}>
                <CodeIcon className="size-4 mr-2 text-critical" />
                <span>Code Block</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] font-semibold">Tasks</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'task')}>
                <TicketIcon className="size-4 mr-2" />
                <span>Task card (:::task)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertBlockAfter(blocks.length - 1, 'tasks')}>
                <ListChecksIcon className="size-4 mr-2" />
                <span>Live task list (:::tasks)</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={insertFullSlidesTemplate}>
                <SparklesIcon className="size-4 mr-2 text-primary" />
                <span>Insert Full 4-Slide Deck Template</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}

function createDefaultBlock(type: BlockType): VisualBlock {
  switch (type) {
    case 'task':
      return { id: uid(), type: 'task', content: '', meta: { taskNumber: null } };
    case 'tasks':
      return { id: uid(), type: 'tasks', content: '', meta: { taskPreset: 'open', taskLimit: TASK_LIST_LIMIT.default } };
    case 'h1':
      return { id: uid(), type: 'h1', content: 'New Slide Header' };
    case 'h2':
      return { id: uid(), type: 'h2', content: 'Section Title' };
    case 'h3':
      return { id: uid(), type: 'h3', content: 'Subheading' };
    case 'paragraph':
      return { id: uid(), type: 'paragraph', content: '' };
    case 'divider':
      return { id: uid(), type: 'divider', content: '---' };
    case 'callout':
      return { id: uid(), type: 'callout', content: 'Write key note or context here.', meta: { calloutType: 'note' } };
    case 'code':
      return { id: uid(), type: 'code', content: '// Write code here\nconsole.log("Ready");', meta: { language: 'typescript' } };
    case 'checklist':
      return {
        id: uid(),
        type: 'checklist',
        content: '',
        meta: {
          items: [
            { id: uid(), checked: false, text: 'Review specifications' },
            { id: uid(), checked: false, text: 'Complete action items' },
          ],
        },
      };
    case 'table':
      return {
        id: uid(),
        type: 'table',
        content: '',
        meta: {
          headers: ['Feature', 'Owner', 'Status'],
          rows: [
            ['Interactive Docs', 'Engineering', 'In Progress'],
            ['Slide Presentation', 'Product', 'Ready'],
          ],
        },
      };
    case 'cards':
      return {
        id: uid(),
        type: 'cards',
        content: '',
        meta: {
          cols: 3,
          cardItems: [
            { id: uid(), icon: '⚡', title: 'Live Preview', desc: 'Re-renders on every keystroke' },
            { id: uid(), icon: '🧩', title: 'Components', desc: 'Visual blocks and cards grids' },
            { id: uid(), icon: '🚀', title: 'md2slides Sync', desc: 'Present and export seamlessly' },
          ],
        },
      };
    case 'stats':
      return {
        id: uid(),
        type: 'stats',
        content: '',
        meta: {
          cols: 3,
          statItems: [
            { id: uid(), value: '99.9%', label: 'Uptime SLA', desc: 'Mission-critical availability' },
            { id: uid(), value: '10x', label: 'Velocity', desc: 'Faster feature shipping' },
            { id: uid(), value: '500k+', label: 'Daily Requests', desc: 'Active workload scale' },
          ],
        },
      };
    case 'timeline':
      return {
        id: uid(),
        type: 'timeline',
        content: '',
        meta: {
          timelineItems: [
            { id: uid(), time: 'Q1', title: 'Foundations & Architecture', desc: 'Database RLS & Core API' },
            { id: uid(), time: 'Q2', title: 'Full Workspace Release', desc: 'Interactive Docs & Boards' },
            { id: uid(), time: 'Q3', title: 'Automations & Slide Sync', desc: 'Integrations and md2slides' },
          ],
        },
      };
  }
}

// Renderer for individual blocks
function BlockRenderer({
  block,
  slideTitle,
  canEdit,
  onChange,
}: {
  block: VisualBlock;
  slideTitle?: string | null;
  canEdit: boolean;
  onChange: (updated: Partial<VisualBlock>) => void;
}) {
  switch (block.type) {
    case 'h1':
      return (
        <input
          type="text"
          value={block.content}
          disabled={!canEdit}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Heading 1"
          className="w-full border-none bg-transparent text-2xl font-bold tracking-tight text-foreground focus:outline-none focus:ring-0 sm:text-3xl"
        />
      );

    case 'h2':
      return (
        <input
          type="text"
          value={block.content}
          disabled={!canEdit}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Heading 2"
          className="w-full border-none bg-transparent text-xl font-semibold tracking-tight text-foreground focus:outline-none focus:ring-0 sm:text-2xl"
        />
      );

    case 'h3':
      return (
        <input
          type="text"
          value={block.content}
          disabled={!canEdit}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Heading 3"
          className="w-full border-none bg-transparent text-lg font-medium text-foreground focus:outline-none focus:ring-0"
        />
      );

    case 'paragraph':
      return (
        <TaskMentionTextarea
          value={block.content}
          disabled={!canEdit}
          onValueChange={(content) => onChange({ content })}
          placeholder="Write text here… (# to reference a task)"
          rows={Math.max(1, block.content.split('\n').length)}
          className="w-full resize-none border-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0"
        />
      );

    case 'task':
      return (
        <div className="grid gap-2">
          {canEdit ? (
            <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground">
              <TicketIcon className="size-3.5" aria-hidden /> Task number
              <input
                type="number"
                min={1}
                max={999999}
                value={block.meta?.taskNumber ?? ''}
                onChange={(e) => onChange({ meta: { ...block.meta, taskNumber: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null } })}
                placeholder="e.g. 12"
                className="h-7 w-24 rounded-md border bg-card px-2 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            </label>
          ) : null}
          {block.meta?.taskNumber ? <TaskEmbedCard number={block.meta.taskNumber} /> : <p className="text-sm text-muted-foreground">Enter a task number to show it as a card.</p>}
        </div>
      );

    case 'tasks': {
      const preset = block.meta?.taskPreset ?? 'open';
      const limit = block.meta?.taskLimit ?? TASK_LIST_LIMIT.default;
      return (
        <div className="grid gap-2">
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                <ListChecksIcon className="size-3.5" aria-hidden /> Show
                <select
                  value={preset}
                  onChange={(e) => onChange({ meta: { ...block.meta, taskPreset: e.target.value as TaskListPreset } })}
                  className="h-7 rounded-md border bg-card px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {TASK_LIST_PRESETS.map((value) => (
                    <option key={value} value={value}>
                      {TASK_LIST_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                Up to
                <input
                  type="number"
                  min={1}
                  max={TASK_LIST_LIMIT.max}
                  value={limit}
                  onChange={(e) => onChange({ meta: { ...block.meta, taskLimit: Math.min(TASK_LIST_LIMIT.max, Math.max(1, Math.round(Number(e.target.value) || 1))) } })}
                  className="h-7 w-16 rounded-md border bg-card px-2 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              </label>
            </div>
          ) : null}
          <TaskListEmbed preset={preset} limit={limit} />
        </div>
      );
    }

    case 'divider':
      return (
        <div className="my-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-primary/30" />
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-[11px] font-semibold text-primary uppercase">
            <FilmIcon className="size-3" />
            <span>{slideTitle || 'Slide Split (---)'}</span>
          </div>
          <div className="h-px flex-1 bg-primary/30" />
        </div>
      );

    case 'callout': {
      const type = block.meta?.calloutType || 'note';
      const colors = {
        note: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
        tip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      };
      const icons = {
        note: <InfoIcon className="size-4 shrink-0 text-blue-400" />,
        tip: <LightbulbIcon className="size-4 shrink-0 text-emerald-400" />,
        warning: <AlertTriangleIcon className="size-4 shrink-0 text-amber-400" />,
      };

      return (
        <div className={cn('flex items-start gap-3 rounded-xl border p-4 backdrop-blur', colors[type])}>
          {icons[type]}
          <div className="flex-1">
            <textarea
              value={block.content}
              disabled={!canEdit}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="Write callout text..."
              rows={Math.max(1, block.content.split('\n').length)}
              className="w-full resize-none border-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
            />
          </div>
        </div>
      );
    }

    case 'checklist': {
      const items = block.meta?.items || [];

      const toggleItem = (itemId: string) => {
        const nextItems = items.map((it) => (it.id === itemId ? { ...it, checked: !it.checked } : it));
        onChange({ meta: { ...block.meta, items: nextItems } });
      };

      const updateItemText = (itemId: string, text: string) => {
        const nextItems = items.map((it) => (it.id === itemId ? { ...it, text } : it));
        onChange({ meta: { ...block.meta, items: nextItems } });
      };

      const addItem = () => {
        const nextItems = [...items, { id: uid(), checked: false, text: '' }];
        onChange({ meta: { ...block.meta, items: nextItems } });
      };

      const deleteItem = (itemId: string) => {
        const nextItems = items.filter((it) => it.id !== itemId);
        onChange({ meta: { ...block.meta, items: nextItems } });
      };

      return (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-card/30 p-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleItem(item.id)}
                disabled={!canEdit}
                className="size-4 rounded border-slate-700 bg-background text-primary accent-primary"
              />
              <input
                type="text"
                value={item.text}
                disabled={!canEdit}
                onChange={(e) => updateItemText(item.id, e.target.value)}
                placeholder="Checklist task..."
                className={cn(
                  'flex-1 border-none bg-transparent text-sm focus:outline-none focus:ring-0',
                  item.checked ? 'text-muted-foreground line-through' : 'text-foreground'
                )}
              />
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => deleteItem(item.id)}
                  className="text-xs text-muted-foreground/60 hover:text-critical"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}

          {canEdit ? (
            <Button variant="ghost" size="sm" onClick={addItem} className="h-6 w-fit gap-1 text-xs text-muted-foreground hover:text-foreground">
              <PlusIcon className="size-3" />
              <span>Add item</span>
            </Button>
          ) : null}
        </div>
      );
    }

    case 'table': {
      const headers = block.meta?.headers || ['Column 1', 'Column 2'];
      const rows = block.meta?.rows || [];

      const updateHeader = (colIdx: number, val: string) => {
        const nextHeaders = [...headers];
        nextHeaders[colIdx] = val;
        onChange({ meta: { ...block.meta, headers: nextHeaders, rows } });
      };

      const updateCell = (rowIdx: number, colIdx: number, val: string) => {
        const nextRows = rows.map((r, rIdx) => {
          if (rIdx !== rowIdx) return r;
          const copy = [...r];
          copy[colIdx] = val;
          return copy;
        });
        onChange({ meta: { ...block.meta, headers, rows: nextRows } });
      };

      const addRow = () => {
        const newRow = headers.map(() => '');
        onChange({ meta: { ...block.meta, headers, rows: [...rows, newRow] } });
      };

      const addCol = () => {
        const nextHeaders = [...headers, `Column ${headers.length + 1}`];
        const nextRows = rows.map((r) => [...r, '']);
        onChange({ meta: { ...block.meta, headers: nextHeaders, rows: nextRows } });
      };

      const deleteRow = (rIdx: number) => {
        const nextRows = rows.filter((_, idx) => idx !== rIdx);
        onChange({ meta: { ...block.meta, headers, rows: nextRows } });
      };

      return (
        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card/40 p-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40">
                {headers.map((h, cIdx) => (
                  <th key={cIdx} className="p-2 font-semibold">
                    <input
                      type="text"
                      value={h}
                      disabled={!canEdit}
                      onChange={(e) => updateHeader(cIdx, e.target.value)}
                      className="w-full border-none bg-transparent font-medium text-foreground focus:outline-none"
                    />
                  </th>
                ))}
                {canEdit ? <th className="w-10 p-2 text-center text-xs text-muted-foreground">+</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-border/30 hover:bg-muted/20">
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="p-2">
                      <input
                        type="text"
                        value={row[cIdx] ?? ''}
                        disabled={!canEdit}
                        onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                        placeholder="Cell value..."
                        className="w-full border-none bg-transparent text-foreground focus:outline-none"
                      />
                    </td>
                  ))}
                  {canEdit ? (
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => deleteRow(rIdx)}
                        className="text-muted-foreground/60 hover:text-critical"
                        title="Delete row"
                      >
                        ×
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>

          {canEdit ? (
            <div className="mt-2 flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={addRow} className="h-6 gap-1 text-xs">
                <PlusIcon className="size-3" />
                <span>Add row</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={addCol} className="h-6 gap-1 text-xs">
                <PlusIcon className="size-3" />
                <span>Add column</span>
              </Button>
            </div>
          ) : null}
        </div>
      );
    }

    case 'cards': {
      const cols = block.meta?.cols || 3;
      const items = block.meta?.cardItems || [];

      const updateCard = (id: string, partial: Partial<{ icon: string; title: string; desc: string }>) => {
        const nextItems = items.map((it) => (it.id === id ? { ...it, ...partial } : it));
        onChange({ meta: { ...block.meta, cardItems: nextItems } });
      };

      const addCard = () => {
        const nextItems = [...items, { id: uid(), icon: '✨', title: 'New Card', desc: 'Card description' }];
        onChange({ meta: { ...block.meta, cardItems: nextItems } });
      };

      const deleteCard = (id: string) => {
        const nextItems = items.filter((it) => it.id !== id);
        onChange({ meta: { ...block.meta, cardItems: nextItems } });
      };

      return (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between text-xs text-primary font-medium">
            <span className="flex items-center gap-1.5">
              <Columns2Icon className="size-3.5" />
              <span>md2slides Cards Grid (:::cards cols={cols})</span>
            </span>
            {canEdit ? (
              <Button variant="ghost" size="sm" onClick={addCard} className="h-6 gap-1 text-xs text-primary hover:bg-primary/20">
                <PlusIcon className="size-3" />
                <span>Add card</span>
              </Button>
            ) : null}
          </div>

          <div
            className={cn(
              'grid gap-3',
              cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 md:grid-cols-4' : 'sm:grid-cols-3'
            )}
          >
            {items.map((card) => (
              <div key={card.id} className="relative rounded-lg border border-border/80 bg-card/80 p-3 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={card.icon}
                    disabled={!canEdit}
                    onChange={(e) => updateCard(card.id, { icon: e.target.value })}
                    className="size-7 rounded bg-muted/50 text-center text-sm focus:outline-none"
                    title="Card icon / emoji"
                  />
                  <input
                    type="text"
                    value={card.title}
                    disabled={!canEdit}
                    onChange={(e) => updateCard(card.id, { title: e.target.value })}
                    placeholder="Card title"
                    className="flex-1 font-semibold text-foreground focus:outline-none"
                  />
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => deleteCard(card.id)}
                      className="text-xs text-muted-foreground hover:text-critical"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <textarea
                  value={card.desc}
                  disabled={!canEdit}
                  onChange={(e) => updateCard(card.id, { desc: e.target.value })}
                  placeholder="Card description..."
                  rows={2}
                  className="mt-2 w-full resize-none border-none bg-transparent text-xs text-muted-foreground focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'stats': {
      const cols = block.meta?.cols || 3;
      const items = block.meta?.statItems || [];

      const updateStat = (id: string, partial: Partial<{ value: string; label: string; desc: string }>) => {
        const nextItems = items.map((it) => (it.id === id ? { ...it, ...partial } : it));
        onChange({ meta: { ...block.meta, statItems: nextItems } });
      };

      const addStat = () => {
        const nextItems = [...items, { id: uid(), value: '99%', label: 'Metric', desc: 'Description' }];
        onChange({ meta: { ...block.meta, statItems: nextItems } });
      };

      const deleteStat = (id: string) => {
        const nextItems = items.filter((it) => it.id !== id);
        onChange({ meta: { ...block.meta, statItems: nextItems } });
      };

      return (
        <div className="flex flex-col gap-2 rounded-xl border border-good/20 bg-good/5 p-4">
          <div className="flex items-center justify-between text-xs text-good font-medium">
            <span className="flex items-center gap-1.5">
              <ActivityIcon className="size-3.5" />
              <span>md2slides KPI Stats (:::stats cols={cols})</span>
            </span>
            {canEdit ? (
              <Button variant="ghost" size="sm" onClick={addStat} className="h-6 gap-1 text-xs text-good hover:bg-good/20">
                <PlusIcon className="size-3" />
                <span>Add stat</span>
              </Button>
            ) : null}
          </div>

          <div
            className={cn(
              'grid gap-3',
              cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 md:grid-cols-4' : 'sm:grid-cols-3'
            )}
          >
            {items.map((stat) => (
              <div key={stat.id} className="relative rounded-lg border border-border/80 bg-card/80 p-3 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={stat.value}
                    disabled={!canEdit}
                    onChange={(e) => updateStat(stat.id, { value: e.target.value })}
                    placeholder="100%"
                    className="w-24 text-2xl font-black text-primary focus:outline-none"
                  />
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => deleteStat(stat.id)}
                      className="text-xs text-muted-foreground hover:text-critical"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <input
                  type="text"
                  value={stat.label}
                  disabled={!canEdit}
                  onChange={(e) => updateStat(stat.id, { label: e.target.value })}
                  placeholder="Metric Label"
                  className="mt-1 w-full font-semibold text-sm text-foreground focus:outline-none"
                />
                <input
                  type="text"
                  value={stat.desc}
                  disabled={!canEdit}
                  onChange={(e) => updateStat(stat.id, { desc: e.target.value })}
                  placeholder="Short explanation"
                  className="mt-0.5 w-full text-xs text-muted-foreground focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'timeline': {
      const items = block.meta?.timelineItems || [];

      const updateTimeline = (id: string, partial: Partial<{ time: string; title: string; desc: string }>) => {
        const nextItems = items.map((it) => (it.id === id ? { ...it, ...partial } : it));
        onChange({ meta: { ...block.meta, timelineItems: nextItems } });
      };

      const addTimeline = () => {
        const nextItems = [...items, { id: uid(), time: 'Q4', title: 'New Milestone', desc: 'Milestone scope' }];
        onChange({ meta: { ...block.meta, timelineItems: nextItems } });
      };

      const deleteTimeline = (id: string) => {
        const nextItems = items.filter((it) => it.id !== id);
        onChange({ meta: { ...block.meta, timelineItems: nextItems } });
      };

      return (
        <div className="flex flex-col gap-2 rounded-xl border border-warning/20 bg-warning/5 p-4">
          <div className="flex items-center justify-between text-xs text-warning font-medium">
            <span className="flex items-center gap-1.5">
              <ClockIcon className="size-3.5" />
              <span>md2slides Roadmap Timeline (:::timeline)</span>
            </span>
            {canEdit ? (
              <Button variant="ghost" size="sm" onClick={addTimeline} className="h-6 gap-1 text-xs text-warning hover:bg-warning/20">
                <PlusIcon className="size-3" />
                <span>Add milestone</span>
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 mt-1">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2 rounded-lg border border-border/80 bg-card/80 p-2.5 shadow-sm">
                <input
                  type="text"
                  value={it.time}
                  disabled={!canEdit}
                  onChange={(e) => updateTimeline(it.id, { time: e.target.value })}
                  placeholder="Q1"
                  className="w-14 rounded bg-warning/10 px-1.5 py-0.5 text-center text-xs font-bold text-warning focus:outline-none"
                />
                <input
                  type="text"
                  value={it.title}
                  disabled={!canEdit}
                  onChange={(e) => updateTimeline(it.id, { title: e.target.value })}
                  placeholder="Milestone title"
                  className="flex-1 text-xs font-semibold text-foreground focus:outline-none"
                />
                <input
                  type="text"
                  value={it.desc}
                  disabled={!canEdit}
                  onChange={(e) => updateTimeline(it.id, { desc: e.target.value })}
                  placeholder="Details"
                  className="flex-1 text-xs text-muted-foreground focus:outline-none"
                />
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => deleteTimeline(it.id)}
                    className="text-xs text-muted-foreground hover:text-critical"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'code':
      return (
        <div className="rounded-lg border border-border/80 bg-slate-950 p-3 font-mono text-xs text-slate-100">
          <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5 text-slate-400">
            <span className="text-[11px] font-semibold uppercase">{block.meta?.language || 'code'}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 text-slate-400 hover:text-white"
              onClick={() => navigator.clipboard.writeText(block.content)}
              title="Copy code"
            >
              <CopyIcon className="size-3" />
            </Button>
          </div>
          <textarea
            value={block.content}
            disabled={!canEdit}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder="// Write code here..."
            rows={Math.max(2, block.content.split('\n').length)}
            className="w-full resize-none border-none bg-transparent font-mono text-xs text-slate-200 focus:outline-none focus:ring-0"
          />
        </div>
      );

    default:
      return null;
  }
}
