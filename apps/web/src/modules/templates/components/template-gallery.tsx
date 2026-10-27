import { useNavigate } from '@tanstack/react-router';
import { DownloadIcon, FileTextIcon, FolderIcon, LayoutTemplateIcon, TrashIcon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { NAME_MAX, TEMPLATE_CATEGORIES, TEMPLATE_LIMITS, type TemplateCategory, type TemplateResponse } from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EntityIcon } from '@/components/common/entity-icon';
import { Modal } from '@/components/kit/modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/errors';
import { useTemplateMutations, useTemplates } from '../hooks/use-templates';
import { downloadTemplate } from '../lib/download-template';

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  engineering: 'Engineering',
  marketing: 'Marketing',
  operations: 'Operations',
  people: 'People',
  general: 'General',
};

type Filter = 'all' | 'mine' | TemplateCategory;

interface TemplateGalleryProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Start a project from a ready-made or saved template, or bring one in from a file. */
export function TemplateGallery({ workspaceId, open, onOpenChange }: TemplateGalleryProps) {
  const templates = useTemplates(workspaceId, open);
  const mutations = useTemplateMutations(workspaceId);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [includeContent, setIncludeContent] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const all = templates.data ?? [];
  const shown = all.filter((template) => filter === 'all' || (filter === 'mine' ? !template.builtIn : template.category === filter));
  const selected = all.find((template) => template.id === selectedId) ?? null;

  const choose = (template: TemplateResponse) => {
    setSelectedId(template.id);
    setName(template.name);
  };

  const create = () => {
    if (!selected) return;
    mutations.apply.mutate(
      { templateId: selected.id, body: { name: name.trim(), includeContent } },
      {
        onSuccess: (space) => {
          toast.success(`${space.name} is ready`);
          onOpenChange(false);
          void navigate({ to: '/w/$workspaceId/p/$spaceId/$view', params: { workspaceId, spaceId: space.id, view: 'list' } });
        },
      },
    );
  };

  const importFile = async (file: File) => {
    if (file.size > TEMPLATE_LIMITS.importBytesMax) {
      toast.error('That file is too large for a template');
      return;
    }
    try {
      const json = await file.text();
      let meta: { name?: unknown; description?: unknown } = {};
      try {
        meta = JSON.parse(json) as typeof meta;
      } catch {
        // The API explains what is wrong with the file.
      }
      const imported = await mutations.importJson.mutateAsync({
        name: typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim().slice(0, TEMPLATE_LIMITS.nameMax) : file.name.replace(/\..*$/, '').slice(0, TEMPLATE_LIMITS.nameMax) || 'Imported template',
        description: typeof meta.description === 'string' ? meta.description.slice(0, TEMPLATE_LIMITS.descriptionMax) : '',
        json,
      });
      toast.success(`Imported ${imported.name}`);
      setFilter('mine');
      choose(imported);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All templates' },
    { key: 'mine', label: 'This workspace' },
    ...TEMPLATE_CATEGORIES.map((category) => ({ key: category, label: CATEGORY_LABELS[category] })),
  ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      tall
      title="New project from a template"
      description="Each template sets up statuses, custom fields, folders, lists and starter work. You can change everything afterwards."
      aside={
        selected ? (
          <TemplatePreview
            template={selected}
            name={name}
            onName={setName}
            includeContent={includeContent}
            onIncludeContent={setIncludeContent}
            creating={mutations.apply.isPending}
            onCreate={create}
            onDelete={() => mutations.remove.mutateAsync(selected.id).then(() => setSelectedId(null))}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <LayoutTemplateIcon className="size-8" />
            Pick a template to see what it sets up.
          </div>
        )
      }
    >
      <div className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium', filter === item.key ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted')}
            >
              {item.label}
            </button>
          ))}
          <span className="flex-1" />
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void importFile(file);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={mutations.importJson.isPending}>
            <UploadIcon /> Import from file
          </Button>
        </div>
        {templates.isLoading ? <p className="text-sm text-muted-foreground">Loading templates…</p> : null}
        {shown.length === 0 && !templates.isLoading ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {filter === 'mine' ? 'No templates of your own yet. Save a project as a template from its Settings tab, or import a file.' : 'Nothing here yet.'}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => choose(template)}
              aria-pressed={selectedId === template.id}
              className={cn('grid gap-2 rounded-xl border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm', selectedId === template.id && 'border-primary ring-1 ring-primary')}
            >
              <span className="flex items-center gap-2.5">
                <EntityIcon variant="badge" icon={template.icon} color={template.color} fallback={{ letter: template.name }} className="size-8 rounded-lg text-sm [&_svg]:size-4.5" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{template.name}</span>
                  <span className="text-xs text-muted-foreground">{template.builtIn ? CATEGORY_LABELS[template.category] : 'This workspace'}</span>
                </span>
              </span>
              <span className="line-clamp-2 text-sm text-muted-foreground">{template.description || 'No description.'}</span>
              <span className="text-xs text-muted-foreground">
                {template.counts.lists} lists · {template.counts.statuses || 'default'} statuses · {template.counts.tasks} tasks
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

interface TemplatePreviewProps {
  template: TemplateResponse;
  name: string;
  onName: (name: string) => void;
  includeContent: boolean;
  onIncludeContent: (include: boolean) => void;
  creating: boolean;
  onCreate: () => void;
  onDelete: () => Promise<unknown>;
}

function TemplatePreview({ template, name, onName, includeContent, onIncludeContent, creating, onCreate, onDelete }: TemplatePreviewProps) {
  const { content } = template;
  const topLists = content.lists.filter((list) => list.folder === null || list.folder === undefined);
  const hasStarterWork = content.tasks.length > 0 || content.docs.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <EntityIcon variant="badge" icon={template.icon} color={template.color} fallback={{ letter: template.name }} className="size-10 rounded-lg text-base [&_svg]:size-5" />
          <h3 className="text-base font-semibold">{template.name}</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>

        <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Statuses</h4>
        <div className="flex flex-wrap gap-1.5">
          {content.statuses.length ? (
            content.statuses.map((status) => (
              <span key={status.name} className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
                <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
                {status.name}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">The standard set</span>
          )}
        </div>

        <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Structure</h4>
        <ul className="grid gap-1 text-sm">
          {content.folders.map((folder, index) =>
            folder.parent === null || folder.parent === undefined ? <FolderPreview key={index} index={index} template={template} depth={0} /> : null,
          )}
          {topLists.map((list) => (
            <li key={list.name} className="flex items-center gap-2">
              <EntityIcon icon={list.icon ?? null} color={list.color} className="text-muted-foreground" /> {list.name}
            </li>
          ))}
        </ul>

        {content.customFields.length ? (
          <>
            <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Custom fields</h4>
            <p className="text-sm">{content.customFields.map((field) => field.name).join(', ')}</p>
          </>
        ) : null}

        {hasStarterWork ? (
          <>
            <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Starter work</h4>
            <ul className="grid gap-1 text-sm">
              {content.tasks.slice(0, 6).map((task) => (
                <li key={task.title} className="truncate">
                  · {task.title}
                </li>
              ))}
              {content.tasks.length > 6 ? <li className="text-xs text-muted-foreground">and {content.tasks.length - 6} more tasks</li> : null}
              {content.docs.map((doc) => (
                <li key={doc.title} className="flex items-center gap-2 truncate">
                  <FileTextIcon className="size-3.5 text-muted-foreground" /> {doc.title}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <div className="grid gap-3 border-t p-5">
        <Input value={name} maxLength={NAME_MAX} onChange={(event) => onName(event.target.value)} aria-label="Project name" placeholder="Project name" />
        {hasStarterWork ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeContent} onCheckedChange={(checked) => onIncludeContent(checked === true)} /> Add the starter tasks and docs
          </label>
        ) : null}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!name.trim() || creating} onClick={onCreate}>
            Create project
          </Button>
          <Button variant="outline" size="icon" aria-label="Export as a file" title="Export as a file" onClick={() => downloadTemplate(template.name, template.description, template.content)}>
            <DownloadIcon />
          </Button>
          {!template.builtIn ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="icon" aria-label={`Delete ${template.name}`}>
                  <TrashIcon />
                </Button>
              }
              title={`Delete ${template.name}?`}
              description="Projects made from it stay as they are."
              confirmLabel="Delete template"
              onConfirm={onDelete}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FolderPreview({ template, index, depth }: { template: TemplateResponse; index: number; depth: number }) {
  const folder = template.content.folders[index];
  if (!folder) return null;
  return (
    <li>
      <span className="flex items-center gap-2" style={{ paddingLeft: `${depth}rem` }}>
        <EntityIcon icon={folder.icon ?? null} color={folder.color} fallback={FolderIcon} className="text-muted-foreground" /> {folder.name}
      </span>
      <ul className="grid gap-1 pt-1" style={{ paddingLeft: `${depth + 1.25}rem` }}>
        {template.content.folders.map((child, at) => (child.parent === index ? <FolderPreview key={at} template={template} index={at} depth={0} /> : null))}
        {template.content.lists
          .filter((list) => list.folder === index)
          .map((list) => (
            <li key={list.name} className="flex items-center gap-2">
              <EntityIcon icon={list.icon ?? null} color={list.color} className="text-muted-foreground" /> {list.name}
            </li>
          ))}
      </ul>
    </li>
  );
}
