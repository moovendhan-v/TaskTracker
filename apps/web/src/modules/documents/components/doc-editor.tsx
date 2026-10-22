import { CheckIcon, EyeIcon, LoaderCircleIcon, PencilLineIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DOC_CONTENT_MAX, DOC_TITLE_MAX, type DocumentResponse } from '@taskflow/shared-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatLongDate } from '@/lib/dates';
import { useMemberName } from '@/modules/members';
import { useDocumentMutations } from '../hooks/use-documents';
import { MarkdownPreview } from './markdown-preview';

const AUTOSAVE_DELAY_MS = 800;

interface DocEditorProps {
  workspaceId: string;
  document: DocumentResponse;
  canEdit: boolean;
}

type SaveState = 'saved' | 'dirty' | 'saving';

/** Title and markdown body with debounced autosave. Read-only for people who can't edit. */
export function DocEditor({ workspaceId, document, canEdit }: DocEditorProps) {
  const { update } = useDocumentMutations(workspaceId);
  const memberName = useMemberName(workspaceId);
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Edits not yet sent. Title and content changes merge, so a quick edit to one never drops the other.
  const pending = useRef<{ title?: string; content?: string }>({});
  const mutate = useRef(update.mutate);
  mutate.current = update.mutate;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const changes = pending.current;
    pending.current = {};
    if (changes.title === undefined && changes.content === undefined) return;
    const body = { ...changes, ...(changes.title !== undefined && { title: changes.title.trim() || 'Untitled' }) };
    setSaveState('saving');
    mutate.current({ documentId: document.id, body }, { onSettled: () => setSaveState('saved') });
  }, [document.id]);

  function scheduleSave(next: { title?: string; content?: string }) {
    pending.current = { ...pending.current, ...next };
    setSaveState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  }

  // Leaving the page (or switching pages) saves whatever is still pending.
  useEffect(() => flush, [flush]);

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-4 p-8">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Created by {memberName(document.createdById) ?? 'someone'} · updated {formatLongDate(document.updatedAt)}</span>
        <span className="flex-1" />
        {canEdit ? <SaveIndicator state={saveState} /> : <span>Read only</span>}
      </div>
      <input
        value={title}
        maxLength={DOC_TITLE_MAX}
        readOnly={!canEdit}
        onChange={(event) => {
          setTitle(event.target.value);
          scheduleSave({ title: event.target.value });
        }}
        aria-label="Page title"
        placeholder="Untitled"
        className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/60"
      />
      {canEdit ? (
        <Tabs defaultValue="write" className="grid gap-3">
          <TabsList className="justify-self-start">
            <TabsTrigger value="write">
              <PencilLineIcon /> Write
            </TabsTrigger>
            <TabsTrigger value="preview">
              <EyeIcon /> Preview
            </TabsTrigger>
          </TabsList>
          <TabsContent value="write">
            <textarea
              value={content}
              maxLength={DOC_CONTENT_MAX}
              onChange={(event) => {
                setContent(event.target.value);
                scheduleSave({ content: event.target.value });
              }}
              aria-label="Page content (markdown)"
              placeholder="Write in markdown: # headings, - lists, **bold**, [links](https://…)"
              className="min-h-[50vh] w-full resize-y rounded-lg border bg-card p-4 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </TabsContent>
          <TabsContent value="preview" className="rounded-lg border bg-card p-6">
            <MarkdownPreview content={content} />
          </TabsContent>
        </Tabs>
      ) : (
        <MarkdownPreview content={content} />
      )}
    </article>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving' || state === 'dirty') {
    return (
      <span className="inline-flex items-center gap-1" role="status">
        <LoaderCircleIcon className="size-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1" role="status">
      <CheckIcon className="size-3.5 text-status-done" /> Saved
    </span>
  );
}
