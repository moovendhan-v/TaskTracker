import { DOC_TEMPLATE_LIMITS, fillDocTemplate, type DocTemplateResponse } from '@taskflow/shared-types';
import { LayoutTemplateIcon, TrashIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { cn } from '@/lib/cn';
import { today } from '@/lib/days';
import { usePermissions } from '@/modules/workspaces';
import { useDocTemplateMutations, useDocTemplates } from '../hooks/use-doc-templates';

/** A new page's title and text from a template: {{date}} becomes today (in your time zone). */
export function pageFromTemplate(template: Pick<DocTemplateResponse, 'name' | 'content'>, today: string): { title: string; content: string } {
  return { title: template.name, content: fillDocTemplate(template.content, today) };
}

/**
 * Pick a template to start a page from: the built-in starters, then the
 * workspace's own (whoever saved one, or a doc manager, can delete it).
 */
export function TemplateGallery({ workspaceId, trigger, onUse, busy }: { workspaceId: string; trigger: ReactNode; onUse: (page: { title: string; content: string }) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: templates = [], isLoading } = useDocTemplates(workspaceId, open);
  const { remove } = useDocTemplateMutations(workspaceId);
  const { data: me } = useCurrentUser();
  const { can } = usePermissions(workspaceId);
  const [selected, setSelected] = useState<string | null>(null);
  const current = templates.find((template) => template.id === selected) ?? templates[0];

  const use = (template: DocTemplateResponse) => {
    onUse(pageFromTemplate(template, today()));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New page from a template</DialogTitle>
          <DialogDescription>Starters that ship with TaskFlow, and pages your workspace saved as templates. {'{{date}}'} becomes today.</DialogDescription>
        </DialogHeader>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ul aria-label="Templates" className="grid content-start gap-1">
            {templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  aria-pressed={current?.id === template.id}
                  onClick={() => setSelected(template.id)}
                  onDoubleClick={() => use(template)}
                  className={cn('grid w-full gap-0.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted', current?.id === template.id && 'bg-muted')}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {template.name}
                    {template.builtIn ? <span className="rounded-full bg-primary/10 px-1.5 text-[10.5px] font-medium text-primary">Starter</span> : null}
                  </span>
                  {template.description ? <span className="line-clamp-2 text-xs text-muted-foreground">{template.description}</span> : null}
                </button>
              </li>
            ))}
          </ul>
          {current ? (
            <div className="grid min-w-0 content-start gap-2">
              <pre aria-label={`Preview of ${current.name}`} className="max-h-80 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap">
                {current.content}
              </pre>
              <div className="flex items-center gap-2">
                {!current.builtIn && (current.createdById === me?.id || can('doc.manage')) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(current.id, { onSuccess: () => (setSelected(null), notify.success(`Deleted “${current.name}”`)) })}
                  >
                    <TrashIcon /> Delete template
                  </Button>
                ) : null}
                <span className="flex-1" />
                <Button disabled={busy} onClick={() => use(current)}>
                  <LayoutTemplateIcon /> Use “{current.name}”
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Keep the open page as a template for the workspace. */
export function SaveAsTemplateDialog({ workspaceId, title, content, open, onOpenChange }: { workspaceId: string; title: string; content: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { save } = useDocTemplateMutations(workspaceId);
  const [name, setName] = useState(title.slice(0, DOC_TEMPLATE_LIMITS.nameMax));
  const [description, setDescription] = useState('');
  const submit = async () => {
    await save.mutateAsync({ name: name.trim(), description: description.trim(), content });
    notify.success(`Saved “${name.trim()}” as a template`);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>Everyone in the workspace can start pages from it. Write {'{{date}}'} where the day a page is made should go.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField id="template-name" label="Name">
            <Input id="template-name" value={name} maxLength={DOC_TEMPLATE_LIMITS.nameMax} onChange={(event) => setName(event.target.value)} />
          </FormField>
          <FormField id="template-description" label="Description" hint="Optional">
            <Textarea id="template-description" rows={2} value={description} maxLength={DOC_TEMPLATE_LIMITS.descriptionMax} onChange={(event) => setDescription(event.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => void submit().catch(() => undefined)}>
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
