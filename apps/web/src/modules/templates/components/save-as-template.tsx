import { DownloadIcon, LayoutTemplateIcon } from 'lucide-react';
import { useState } from 'react';
import { TEMPLATE_CATEGORIES, TEMPLATE_LIMITS, type TemplateCategory } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { templatesApi } from '../api/templates.api';
import { useTemplateMutations } from '../hooks/use-templates';
import { downloadTemplate } from '../lib/download-template';

/** Turns a project into a reusable template for this workspace, or into a file for another one. */
export function SaveAsTemplate({ workspaceId, spaceId, spaceName }: { workspaceId: string; spaceId: string; spaceName: string }) {
  const mutations = useTemplateMutations(workspaceId);
  const [name, setName] = useState(`${spaceName} template`);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('general');
  const [includeContent, setIncludeContent] = useState(false);
  const [exporting, setExporting] = useState(false);

  const save = () =>
    mutations.saveFromSpace.mutate(
      { spaceId, body: { name: name.trim(), description: description.trim(), category, includeContent } },
      { onSuccess: (template) => toast.success(`Saved “${template.name}”. Find it under New project → From a template.`) },
    );
  const exportFile = async () => {
    setExporting(true);
    try {
      downloadTemplate(name.trim() || spaceName, description.trim(), await templatesApi.spaceContent(workspaceId, spaceId, includeContent));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Input value={name} maxLength={TEMPLATE_LIMITS.nameMax} onChange={(event) => setName(event.target.value)} aria-label="Template name" />
        <Select value={category} onValueChange={(value: TemplateCategory) => setCategory(value)}>
          <SelectTrigger aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {item[0]?.toUpperCase()}
                {item.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea rows={2} value={description} maxLength={TEMPLATE_LIMITS.descriptionMax} placeholder="What is this template for?" onChange={(event) => setDescription(event.target.value)} aria-label="Template description" />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={includeContent} onCheckedChange={(checked) => setIncludeContent(checked === true)} /> Include open tasks and docs as starter work
      </label>
      <p className="text-xs text-muted-foreground">Statuses, fields, lists and automations come along. Steps that name people, channels or webhooks are left out, so the template works in any workspace.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!name.trim() || mutations.saveFromSpace.isPending} onClick={save}>
          <LayoutTemplateIcon /> Save as template
        </Button>
        <Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportFile()}>
          <DownloadIcon /> Export as .tflow
        </Button>
      </div>
    </div>
  );
}
