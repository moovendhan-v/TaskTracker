import { describe, expect, it } from 'vitest';
import { createWorkspace } from './support/fixtures.js';

const CATALOG = 'query($w: ID!) { md2slidesCatalog(workspaceId: $w) { source templates { id name category author authorGithub md } contributors { github templates } snippets { label category md } } }';

describe('md2slides catalog', () => {
  it('lists community templates with credits, ranked contributors and snippets (from the bundled snapshot in tests)', async () => {
    const ws = await createWorkspace('md2slides owner');
    const { md2slidesCatalog } = await ws.owner.data<{
      md2slidesCatalog: { source: string; templates: { id: string; author: string; md: string }[]; contributors: { github: string; templates: number }[]; snippets: { label: string; md: string }[] };
    }>(CATALOG, { w: ws.workspaceId });
    expect(md2slidesCatalog.source).toBe('snapshot');
    expect(md2slidesCatalog.templates.length).toBeGreaterThan(10);
    expect(md2slidesCatalog.templates.every((template) => template.md.length > 0 && template.author.length > 0)).toBe(true);
    const counts = md2slidesCatalog.contributors.map((person) => person.templates);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(md2slidesCatalog.snippets.some((snippet) => snippet.md.includes(':::cards'))).toBe(true);

    // A template becomes a page like any other: its Markdown is sanitized on the way in.
    const template = md2slidesCatalog.templates[0]!;
    const { createDocument } = await ws.owner.data<{ createDocument: { id: string; content: string } }>('mutation($w: ID!, $input: CreateDocumentInput!) { createDocument(workspaceId: $w, input: $input) { id content } }', {
      w: ws.workspaceId,
      input: { title: template.id, content: `${template.md}\n\n[x](javascript:alert(1))` },
    });
    expect(createDocument.content).not.toMatch(/javascript:/i);

    const other = await createWorkspace('md2slides outsider');
    expect((await other.owner.error(CATALOG, { w: ws.workspaceId })).code).toMatch(/FORBIDDEN|NOT_FOUND/);
  });
});
