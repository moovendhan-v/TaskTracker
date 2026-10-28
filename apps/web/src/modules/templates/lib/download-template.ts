import type { TemplateContent } from '@taskflow/shared-types';

/** Saves a template as a JSON file the import accepts, named after the template. */
export function downloadTemplate(name: string, description: string, content: TemplateContent): void {
  const json = JSON.stringify({ name, description, content }, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'template'}.taskflow-template.json`;
  link.click();
  URL.revokeObjectURL(url);
}
