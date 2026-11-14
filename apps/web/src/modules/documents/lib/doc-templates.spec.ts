import { describe, expect, it } from 'vitest';
import { BUILT_IN_DOC_TEMPLATES } from '@taskflow/shared-types';
import { pageFromTemplate } from '../components/doc-templates';

describe('pages from templates', () => {
  it('copies the text and puts today in for every {{date}}', () => {
    expect(pageFromTemplate({ name: 'Stand-up', content: '# Stand-up {{date}}\n\nSee {{date}} notes' }, '2026-11-14')).toEqual({ title: 'Stand-up', content: '# Stand-up 2026-11-14\n\nSee 2026-11-14 notes' });
  });

  it('ships four starters, each with something to fill in', () => {
    expect(BUILT_IN_DOC_TEMPLATES.map((template) => template.name)).toEqual(['Meeting notes', 'Project brief', 'Retrospective', 'Decision record']);
    const meeting = pageFromTemplate(BUILT_IN_DOC_TEMPLATES[0]!, '2026-11-14');
    expect(meeting.content.startsWith('# Meeting notes, 2026-11-14')).toBe(true);
    expect(meeting.content).not.toContain('{{date}}');
  });
});
