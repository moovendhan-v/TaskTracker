import {
  ActivityIcon,
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  CodeIcon,
  Columns2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  LayoutTemplateIcon,
  ListTodoIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  PlusIcon,
  PresentationIcon,
  PrinterIcon,
  QuoteIcon,
  TableIcon,
  WorkflowIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DOC_CONTENT_MAX, DOC_TITLE_MAX, type DocumentResponse } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';
import { formatLongDate } from '@/lib/dates';
import { useDocumentMutations } from '../hooks/use-documents';
import { DocVisualEditor } from './doc-visual-editor';
import { MarkdownPreview } from './markdown-preview';
import { TaskMentionTextarea } from './task-embeds';
import { SlidePresentationModal } from './slide-presentation-modal';
import { UserAvatar } from '@/components/common/user-avatar';
import { useLiveDoc } from '../live/use-live-doc';
import { personColor } from '../lib/caret-coordinates';
import { RemoteCarets } from './remote-carets';
import type { LivePeerView, LiveStatus } from '../live/live-doc';

const AUTOSAVE_DELAY_MS = 800;

interface DocEditorProps {
  workspaceId: string;
  document: DocumentResponse;
  canEdit: boolean;
  treeOpen?: boolean;
  onToggleTree?: () => void;
}

type SaveState = 'saved' | 'dirty' | 'saving';
type EditorMode = 'visual' | 'split' | 'preview';

export function DocEditor({ workspaceId, document, canEdit, treeOpen = true, onToggleTree }: DocEditorProps) {
  const { mutate } = useDocumentMutations(workspaceId).update;
  const [localTitle, setLocalTitle] = useState(document.title);
  const [localContent, setLocalContent] = useState(document.content);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [mode, setMode] = useState<EditorMode>('visual');
  const [fullWidth, setFullWidth] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [superView, setSuperView] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('view') === 'full';
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Live editing (C5): everyone on the page edits one shared text. Until it connects the page
  // waits; if live editing isn't available it saves on its own as before.
  const live = useLiveDoc(workspaceId, document.id, true);
  const liveOn = live.status === 'live' || live.status === 'offline';
  const editable = canEdit && live.status !== 'connecting' && !(liveOn && live.readOnly);
  // Live, the shared text and title are the page; otherwise what you typed here.
  const content = liveOn ? live.text : localContent;
  const title = liveOn ? live.title : localTitle;
  // Someone else's change moves your caret along with the text, instead of jumping.
  useEffect(
    () =>
      live.live?.onRemoteChange((map, field) => {
        const element = field === 'title' ? titleRef.current : textareaRef.current;
        if (!element || window.document.activeElement !== element) return;
        const start = map(element.selectionStart ?? 0);
        const end = map(element.selectionEnd ?? 0);
        const direction = element.selectionDirection ?? undefined;
        requestAnimationFrame(() => element.setSelectionRange(start, end, direction));
      }),
    [live.live],
  );
  /** Shares exactly where your cursor (or selection) is in the text or the title. */
  const shareCursor = (field: 'markdown' | 'title') => {
    const element = field === 'title' ? titleRef.current : textareaRef.current;
    if (!element || !liveOn) return;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? start;
    const backward = element.selectionDirection === 'backward';
    live.live?.setCursor(field, backward ? end : start, backward ? start : end);
  };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ title?: string; content?: string }>({});

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const changes = pending.current;
    pending.current = {};
    if (changes.title === undefined && changes.content === undefined) return;
    const body = { ...changes, ...(changes.title !== undefined && { title: changes.title.trim() || 'Untitled' }) };
    setSaveState('saving');
    mutate({ documentId: document.id, body }, { onSettled: () => setSaveState('saved') });
  }, [document.id, mutate]);

  function scheduleSave(next: { title?: string; content?: string }) {
    pending.current = { ...pending.current, ...next };
    setSaveState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  }

  useEffect(() => flush, [flush]);

  /** A change you made to the page's text: shared live, or saved on its own when not live. */
  function changeContent(next: string) {
    if (liveOn) return live.live?.setText(next);
    setLocalContent(next);
    scheduleSave({ content: next });
  }

  // Insert markdown snippet when in raw textarea mode
  const insertSnippet = (snippet: string) => {
    const next = content ? `${content}\n\n${snippet}` : snippet;
    changeContent(next);
    toast.success('Block added');
  };

  // Export handlers
  const exportMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${title.trim() || 'document'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Document downloaded as Markdown');
  };

  const exportPdf = () => {
    window.print();
  };

  // Export to MD2Docs
  const exportToMd2Docs = () => {
    void navigator.clipboard.writeText(content).then(() => {
      toast.success('Document copied! Opening MD2Docs dashboard…');
      window.open('https://md2docs.cybertechmind.com/dashboard', '_blank', 'noopener,noreferrer');
    });
  };

  // Export to md2slides
  const exportToMd2Slides = () => {
    let slideDeck = content;
    if (!slideDeck.includes('---')) {
      slideDeck = `# ${title}\n\n${content.replace(/\n(## [^\n]+)/g, '\n---\n\n$1')}`;
    }
    void navigator.clipboard.writeText(slideDeck).then(() => {
      toast.success('Slide deck copied! Opening md2slides studio…');
      window.open('https://md2slides.cybertechmind.com/app', '_blank', 'noopener,noreferrer');
    });
  };

  const openInNewTab = () => {
    const url = `${window.location.pathname}?view=full`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-background transition-all',
        superView
          ? 'fixed inset-0 z-50 h-screen w-screen overflow-hidden'
          : 'h-full overflow-hidden'
      )}
    >
      {/* Top Action & Mode Bar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card/70 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          {superView ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuperView(false)}
              className="h-7 gap-1.5 px-2.5 text-xs font-medium"
              title="Exit Super View"
            >
              <ArrowLeftIcon className="size-3.5" />
              <span>Back</span>
            </Button>
          ) : onToggleTree ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={onToggleTree}
              title={treeOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={treeOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {treeOpen ? <PanelLeftCloseIcon className="size-4" /> : <PanelLeftIcon className="size-4" />}
            </Button>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Updated {formatLongDate(document.updatedAt)}</span>
            <span className="hidden sm:inline">·</span>
            {liveOn || live.status === 'connecting' ? (
              <LiveIndicator status={live.status} readOnly={!canEdit || live.readOnly} error={live.error} saving={live.pending || saveState !== 'saved'} />
            ) : canEdit ? (
              <SaveIndicator state={saveState} />
            ) : (
              <span>Read only</span>
            )}
            {live.peers.length ? <LivePeers peers={live.peers} /> : null}
          </div>
        </div>

        {/* Editor controls */}
        <div className="flex items-center gap-1.5">
          {/* Present Slides Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPresentationOpen(true)}
            className="h-7 gap-1.5 border-primary/30 bg-primary/10 px-2.5 text-xs font-medium text-primary hover:bg-primary/20"
            title="Present document as interactive slides"
          >
            <PresentationIcon className="size-3.5" />
            <span>Present Slides</span>
          </Button>

          {canEdit ? (
            <>
              {/* Add Component Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs font-medium">
                    <PlusIcon className="size-3.5 text-primary" />
                    <span>Add block</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">Headings</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => insertSnippet('# Heading 1\n')}>
                    <Heading1Icon className="size-4 mr-2 text-chart-1" />
                    <span>Heading 1</span>
                    <span className="ml-auto text-xs text-muted-foreground">#</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertSnippet('## Heading 2\n')}>
                    <Heading2Icon className="size-4 mr-2 text-chart-1" />
                    <span>Heading 2</span>
                    <span className="ml-auto text-xs text-muted-foreground">##</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertSnippet('### Heading 3\n')}>
                    <Heading3Icon className="size-4 mr-2 text-chart-1" />
                    <span>Heading 3</span>
                    <span className="ml-auto text-xs text-muted-foreground">###</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">Components</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      insertSnippet(
                        `| Feature | Owner | Status |\n|---|---|---|\n| Interactive Docs | Team | Active |\n| Slide Presentation | Product | Ready |\n\n`
                      )
                    }
                  >
                    <TableIcon className="size-4 mr-2 text-good" />
                    <span>Interactive Table</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertSnippet('- [ ] Review requirements\n- [ ] Ship to production\n\n')}>
                    <ListTodoIcon className="size-4 mr-2 text-primary" />
                    <span>Task Checklist</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertSnippet('> [!NOTE]\n> Add important context or takeaway here.\n\n')}>
                    <QuoteIcon className="size-4 mr-2 text-warning" />
                    <span>Callout Box</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      insertSnippet(
                        `:::cards cols=3\n- 🚀 Speed | Instant live updates & HMR\n- 🛡️ Security | Row-level data isolation\n- 📊 Presentation | Embedded md2slides player\n:::\n\n`
                      )
                    }
                  >
                    <Columns2Icon className="size-4 mr-2 text-accent" />
                    <span>md2slides Cards (:::cards)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      insertSnippet(
                        `:::stats cols=3\n- 99.9% | Uptime SLA | Guaranteed production SLA\n- 10x | Velocity | Faster sprint execution\n- 500k+ | Requests | Daily workload scale\n:::\n\n`
                      )
                    }
                  >
                    <ActivityIcon className="size-4 mr-2 text-good" />
                    <span>KPI Metrics (:::stats)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      insertSnippet(
                        `:::timeline\n- Q1 | Architecture & RLS | Security foundations\n- Q2 | Interactive Docs | Full ClickUp block editor\n- Q3 | md2slides Integration | In-app presentations\n:::\n\n`
                      )
                    }
                  >
                    <ClockIcon className="size-4 mr-2 text-warning" />
                    <span>Roadmap (:::timeline)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertSnippet('```mermaid\ngraph TD;\n  Ideate --> Prototype;\n  Prototype --> Ship;\n```\n\n')}>
                    <WorkflowIcon className="size-4 mr-2 text-chart-2" />
                    <span>Mermaid Diagram</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertSnippet('```typescript deck.ts {2|3}\n// step-by-step code\nconst deck = await parse("presentation.md");\npresent(deck);\n```\n\n')}>
                    <CodeIcon className="size-4 mr-2 text-critical" />
                    <span>Code Block</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertSnippet('---\n\n')}>
                    <MinusIcon className="size-4 mr-2 text-muted-foreground" />
                    <span>New Slide Divider (---)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* View Mode Toggle: Visual (ClickUp) vs Markdown */}
              <div role="group" aria-label="Editor mode" className="flex items-center rounded-md border bg-muted/30 p-0.5">
                <button
                  type="button"
                  aria-label="Visual"
                  aria-pressed={mode === 'visual'}
                  onClick={() => setMode('visual')}
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors',
                    mode === 'visual' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="ClickUp visual block editor (no raw markdown)"
                >
                  <LayoutTemplateIcon className="size-3 text-primary" />
                  <span>Visual</span>
                </button>
                <button
                  type="button"
                  aria-label="Markdown"
                  aria-pressed={mode === 'split'}
                  onClick={() => setMode('split')}
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors',
                    mode === 'split' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Side-by-side Markdown source & preview"
                >
                  <Columns2Icon className="size-3" />
                  <span className="hidden sm:inline">Markdown</span>
                </button>
                <button
                  type="button"
                  aria-label="Preview"
                  aria-pressed={mode === 'preview'}
                  onClick={() => setMode('preview')}
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors',
                    mode === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Clean reading preview"
                >
                  <EyeIcon className="size-3" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              </div>
            </>
          ) : null}

          {/* Width toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={() => setFullWidth(!fullWidth)}
            title={fullWidth ? 'Centered reading width' : 'Full width'}
          >
            {fullWidth ? <Minimize2Icon className="size-3.5" /> : <Maximize2Icon className="size-3.5" />}
          </Button>

          {/* Super View (Full Page / Separate Window) Toggle */}
          <Button
            variant={superView ? 'secondary' : 'ghost'}
            size="icon-sm"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={() => setSuperView(!superView)}
            title={superView ? 'Exit Full View' : 'Open in Full View (Super View)'}
          >
            <Maximize2Icon className="size-3.5" />
          </Button>

          {/* Export Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
                <DownloadIcon className="size-3.5 text-muted-foreground" />
                <span>Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Export as PDF & Docs</DropdownMenuLabel>
              <DropdownMenuItem onClick={exportToMd2Docs} className="cursor-pointer">
                <FileTextIcon className="size-4 mr-2 text-primary" />
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 font-medium">
                    MD2Docs (PDF / Docs) <ExternalLinkIcon className="size-3" />
                  </span>
                  <span className="text-[10px] text-muted-foreground">Opens md2docs.cybertechmind.com</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf} className="cursor-pointer">
                <PrinterIcon className="size-4 mr-2 text-good" />
                <span>Print / Save as PDF</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Present Slides</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setPresentationOpen(true)} className="cursor-pointer">
                <PresentationIcon className="size-4 mr-2 text-accent" />
                <span>Present In-App (Embedded)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToMd2Slides} className="cursor-pointer">
                <PresentationIcon className="size-4 mr-2 text-chart-1" />
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 font-medium">
                    md2slides Studio <ExternalLinkIcon className="size-3" />
                  </span>
                  <span className="text-[10px] text-muted-foreground">Opens md2slides.cybertechmind.com</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Document File</DropdownMenuLabel>
              <DropdownMenuItem onClick={exportMarkdown} className="cursor-pointer">
                <FileTextIcon className="size-4 mr-2 text-muted-foreground" />
                <span>Download Markdown (.md)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openInNewTab} className="cursor-pointer">
                <ExternalLinkIcon className="size-4 mr-2 text-muted-foreground" />
                <span>Open in Separate Browser Tab</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Editor & Content Workspace */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className={cn('mx-auto transition-all', fullWidth ? 'max-w-full px-2' : 'max-w-4xl')}>
          {/* Title Input: shared live like the text */}
          <div className="relative mb-4">
            <input
              ref={titleRef}
              value={title}
              maxLength={DOC_TITLE_MAX}
              readOnly={!editable}
              onChange={(event) => {
                if (liveOn) return live.live?.setTitle(event.target.value);
                setLocalTitle(event.target.value);
                scheduleSave({ title: event.target.value });
              }}
              onSelect={() => shareCursor('title')}
              onKeyUp={() => shareCursor('title')}
              onMouseUp={() => shareCursor('title')}
              onFocus={() => shareCursor('title')}
              aria-label="Document title"
              placeholder="Untitled document"
              className="w-full border-b border-transparent bg-transparent pb-2 text-2xl sm:text-4xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/30 focus:border-border/60 transition-colors"
            />
            {liveOn ? <RemoteCarets fieldRef={titleRef} field="title" peers={live.peers} value={title} /> : null}
          </div>

          {/* Mode 1: ClickUp Visual Block Editor (DEFAULT - no raw markdown codes) */}
          {mode === 'visual' ? (
            <DocVisualEditor
              key={document.id}
              initialMarkdown={content}
              canEdit={editable}
              onChange={changeContent}
            />
          ) : mode === 'split' ? (
            /* Mode 2: Split Markdown & Preview (For developers) */
            <div className="grid min-h-[70vh] gap-4 md:grid-cols-2">
              <TaskMentionTextarea
                ref={textareaRef}
                value={content}
                maxLength={DOC_CONTENT_MAX}
                readOnly={!editable}
                onValueChange={changeContent}
                onSelect={() => shareCursor('markdown')}
                onKeyUp={() => shareCursor('markdown')}
                onMouseUp={() => shareCursor('markdown')}
                onFocus={() => shareCursor('markdown')}
                overlay={liveOn ? <RemoteCarets fieldRef={textareaRef} field="markdown" peers={live.peers} value={content} /> : null}
                aria-label="Page content (markdown)"
                placeholder="Type raw markdown here… (# to reference a task)"
                className="size-full min-h-[70vh] resize-none rounded-xl border bg-card/60 p-5 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="rounded-xl border bg-card/30 p-6 overflow-y-auto">
                <MarkdownPreview content={content} />
              </div>
            </div>
          ) : (
            /* Mode 3: Clean Preview Only */
            <article aria-label="Preview" className="rounded-xl border bg-card/40 p-6 sm:p-8 shadow-sm">
              <MarkdownPreview content={content} />
            </article>
          )}
        </div>
      </div>

      {/* Embedded Slide Presentation Player */}
      <SlidePresentationModal
        open={presentationOpen}
        onClose={() => setPresentationOpen(false)}
        documentTitle={title}
        content={content}
      />
    </div>
  );
}

/** Live status in the page header: connecting, live (and whether the latest change is saved), or offline. */
function LiveIndicator({ status, readOnly, error, saving }: { status: LiveStatus; readOnly: boolean; error: string | null; saving: boolean }) {
  if (error) {
    return (
      <span className="text-xs text-destructive" role="alert">
        {error}
      </span>
    );
  }
  const label =
    status === 'connecting' ? 'Connecting…' : status === 'offline' ? 'Offline: your changes sync when you’re back' : readOnly ? 'Live · read only' : saving ? 'Live · saving…' : 'Live · saved';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
      <span aria-hidden className={cn('size-1.5 rounded-full', status === 'live' ? 'bg-good' : status === 'offline' ? 'bg-amber-500' : 'animate-pulse bg-muted-foreground')} />
      {label}
    </span>
  );
}

/** Who else has the page open, and which line they're on. */
function LivePeers({ peers }: { peers: readonly LivePeerView[] }) {
  // One avatar per person, even with the page open in several tabs.
  const people = [...new Map(peers.map((peer) => [peer.id, peer])).values()];
  return (
    <ul aria-label="Also on this page" className="flex -space-x-1.5">
      {people.slice(0, 5).map((peer) => (
        <li
          key={peer.id}
          title={`${peer.name}${peer.field === 'title' ? ' · editing the title' : peer.line ? ` · line ${peer.line}` : ''}${peer.canEdit ? '' : ' · viewing'}`}
          className="animate-in fade-in-0 zoom-in-95 rounded-full"
          style={{ boxShadow: `0 0 0 2px ${personColor(peer.id)}` }}
        >
          <UserAvatar name={peer.name} className="size-6 border-2 border-background text-[10px]" />
          <span className="sr-only">{peer.name}</span>
        </li>
      ))}
      {people.length > 5 ? <li className="ml-2 self-center text-xs">+{people.length - 5}</li> : null}
    </ul>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving' || state === 'dirty') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
        <LoaderCircleIcon className="size-3 animate-spin text-primary" /> Saving…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
      <CheckIcon className="size-3 text-good" /> Saved
    </span>
  );
}
