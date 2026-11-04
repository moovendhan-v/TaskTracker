import type { TemplateContent } from '@taskflow/shared-types';
import { downloadTflow } from '@/lib/tflow';

/** Saves a template as a .tflow file the import accepts, named after the template. */
export function downloadTemplate(name: string, description: string, content: TemplateContent): void {
  downloadTflow('project-template', name, content, { description });
}
