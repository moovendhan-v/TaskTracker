import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TASK_UPLOAD_MAX_BYTES, type TaskAttachmentResponse, type TaskResponse } from '@taskflow/shared-types';
import { DownloadIcon, FileTextIcon, PaperclipIcon, PlusIcon, XIcon } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Section } from '@/components/kit/section';
import { notify } from '@/components/kit/notify';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import { formatBytes, UPLOAD_ACCEPT } from '@/lib/upload';
import { usePermissions } from '@/modules/workspaces';
import { attachmentsApi } from '../../api/attachments.api';

const attachmentsKey = (workspaceId: string, taskId: string) => [...queryKeys.tasksRoot(workspaceId), 'attachments', taskId] as const;

interface Uploading {
  key: string;
  name: string;
  progress: number;
}

/** Files on a task: drop or pick to add (task.update), images show as thumbnails, others as download cards. */
export function TaskAttachments({ workspaceId, task }: { workspaceId: string; task: TaskResponse }) {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const { canIn } = usePermissions(workspaceId);
  const canAdd = canIn(task.spaceId, 'task.update');
  const canDeleteAny = canIn(task.spaceId, 'task.delete');
  const picker = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [dragging, setDragging] = useState(false);
  const key = attachmentsKey(workspaceId, task.id);
  const { data: files = [] } = useQuery({ queryKey: key, queryFn: () => attachmentsApi.list(workspaceId, task.id) });

  const add = (list: FileList | File[]) => {
    for (const file of [...list]) {
      if (file.size > TASK_UPLOAD_MAX_BYTES) {
        notify.info(`${file.name} is over 10 MB`);
        continue;
      }
      counter.current += 1;
      const id = `${file.name}-${counter.current}`;
      setUploading((current) => [...current, { key: id, name: file.name, progress: 0 }]);
      attachmentsApi.upload(workspaceId, task.id, file, (progress) => setUploading((current) => current.map((item) => (item.key === id ? { ...item, progress } : item))))
        .then(() => queryClient.invalidateQueries({ queryKey: key }))
        .catch((error: unknown) => notify.error(error))
        .finally(() => setUploading((current) => current.filter((item) => item.key !== id)));
    }
  };
  const remove = async (file: TaskAttachmentResponse) => {
    try {
      await attachmentsApi.remove(workspaceId, file.id);
      void queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      notify.error(error);
    }
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (canAdd) add(event.dataTransfer.files);
  };

  const images = files.filter((file) => file.isImage);
  const others = files.filter((file) => !file.isImage);
  const removable = (file: TaskAttachmentResponse) => canDeleteAny || file.uploaderId === me?.id;

  return (
    <Section
      storageKey="task-detail:attachments"
      className="border-t pt-4"
      title={
        <span className="flex items-center gap-2 text-sm font-semibold">
          <PaperclipIcon className="size-4 text-muted-foreground" /> Attachments
        </span>
      }
      count={files.length}
    >
      <div
        onDragOver={(event) => {
          if (!canAdd || !event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn('grid gap-2 rounded-lg pt-1', dragging && 'bg-primary-soft/50 outline-2 outline-ring outline-dashed')}
      >
        {images.length ? (
          <ul aria-label="Images" className="flex flex-wrap gap-2">
            {images.map((file) => (
              <li key={file.id} className="group/file relative">
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <img src={file.thumbnailUrl ?? file.url} alt={file.fileName} loading="lazy" className="h-24 max-w-48 object-cover" />
                </a>
                {removable(file) ? <RemoveButton name={file.fileName} onClick={() => void remove(file)} className="absolute top-1 right-1 hidden bg-card group-hover/file:grid group-focus-within/file:grid" /> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {others.length ? (
          <ul aria-label="Files" className="grid gap-1">
            {others.map((file) => (
              <li key={file.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                <FileTextIcon aria-hidden className="size-4 shrink-0 text-ring" />
                <a href={file.url} download={file.fileName} className="min-w-0 flex-1 truncate hover:text-primary">
                  {file.fileName}
                </a>
                <span className="shrink-0 font-mono text-[11px] text-subtle-foreground">{formatBytes(file.size)}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{file.uploaderName ?? ''}</span>
                <a href={file.url} download={file.fileName} aria-label={`Download ${file.fileName}`} className="text-muted-foreground hover:text-foreground">
                  <DownloadIcon className="size-3.5" />
                </a>
                {removable(file) ? <RemoveButton name={file.fileName} onClick={() => void remove(file)} /> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {uploading.map((item) => (
          <div key={item.key} className="relative flex items-center gap-2 overflow-hidden rounded-md border px-2 py-1.5 text-xs">
            <PaperclipIcon aria-hidden className="size-3.5 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            <span className="font-mono text-subtle-foreground">{Math.round(item.progress * 100)}%</span>
            <span aria-hidden className="absolute bottom-0 left-0 h-0.5 bg-ring" style={{ width: `${item.progress * 100}%` }} />
          </div>
        ))}
        {canAdd ? (
          <>
            <input
              ref={picker}
              type="file"
              multiple
              hidden
              accept={UPLOAD_ACCEPT}
              aria-label="Attach files to this task"
              onChange={(event) => {
                if (event.target.files) add(event.target.files);
                event.target.value = '';
              }}
            />
            <button type="button" onClick={() => picker.current?.click()} className="flex items-center gap-2 px-2 py-1 text-left text-sm text-muted-foreground hover:text-foreground">
              <PlusIcon aria-hidden className="size-3.5" /> Add files <span className="text-xs text-subtle-foreground">or drop them here · up to 10 MB</span>
            </button>
          </>
        ) : files.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">No files.</p>
        ) : null}
      </div>
    </Section>
  );
}

function RemoveButton({ name, onClick, className }: { name: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" aria-label={`Remove ${name}`} onClick={onClick} className={cn('size-6 place-items-center rounded-md text-muted-foreground hover:text-destructive', className ?? 'grid')}>
      <XIcon className="size-3.5" />
    </button>
  );
}
