import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

interface Template {
  id: string;
  name: string;
  builtIn: boolean;
  counts: { statuses: number; lists: number; tasks: number; docs: number; folders: number; customFields: number };
  content: Record<string, unknown>;
}

const TEMPLATES = 'query($w: ID!) { projectTemplates(workspaceId: $w) { id name builtIn counts { statuses customFields folders lists tasks docs } content } }';
const APPLY = 'mutation($w: ID!, $t: String!, $input: CreateFromTemplateInput!) { createSpaceFromTemplate(workspaceId: $w, templateId: $t, input: $input) { id name icon color } }';

describe('project templates', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });

  beforeAll(async () => {
    ws = await createWorkspace('Template owner');
    member = await TestUser.signUp('Template member');
    await addMember(ws, member, 'Member');
  });

  it('lists the built-in gallery to every member', async () => {
    const { projectTemplates } = await member.data<{ projectTemplates: Template[] }>(TEMPLATES, vars());
    expect(projectTemplates.find((template) => template.id === 'builtin:scrum')).toMatchObject({ builtIn: true, counts: { statuses: 6, lists: 3 } });
  });

  it('creates a whole space from a template in one go', async () => {
    const { createSpaceFromTemplate: space } = await ws.owner.data<{ createSpaceFromTemplate: { id: string; icon: string } }>(APPLY, vars({ t: 'builtin:marketing-campaign', input: { name: 'Spring launch' } }));
    expect(space.icon).toBe('megaphone');
    const read = await ws.owner.data<{
      statuses: { name: string }[];
      folders: { id: string; spaceId: string }[];
      lists: { name: string; spaceId: string; folderId: string | null }[];
      customFields: { name: string; spaceId: string | null }[];
      searchTasks: { total: number };
      documents: { title: string; spaceId: string | null }[];
    }>(
      `query($w: ID!, $s: ID!) {
        statuses(workspaceId: $w, spaceId: $s) { name }
        folders(workspaceId: $w) { id spaceId }
        lists(workspaceId: $w) { name spaceId folderId }
        customFields(workspaceId: $w) { name spaceId }
        searchTasks(workspaceId: $w, spaceId: $s, query: { pageSize: 50 }) { total }
        documents(workspaceId: $w) { title spaceId }
      }`,
      vars({ s: space.id }),
    );
    expect(read.statuses.map((status) => status.name)).toEqual(['Idea', 'Planned', 'In production', 'Approval', 'Live']);
    const folder = read.folders.find((item) => item.spaceId === space.id);
    expect(read.lists.filter((list) => list.spaceId === space.id).every((list) => list.folderId === folder?.id)).toBe(true);
    expect(read.customFields.filter((field) => field.spaceId === space.id).map((field) => field.name)).toEqual(['Channel', 'Budget', 'Launch date']);
    // Five tasks plus two subtasks.
    expect(read.searchTasks.total).toBe(7);
    expect(read.documents.find((doc) => doc.title === 'Campaign brief')?.spaceId).toBe(space.id);
  });

  it('needs space.manage to apply one', async () => {
    expect((await member.error(APPLY, vars({ t: 'builtin:kanban', input: { name: 'Mine' } }))).code).toBe('FORBIDDEN');
  });

  it('saves a space as a template, exports it and imports it back', async () => {
    const { saveSpaceAsTemplate: saved } = await ws.owner.data<{ saveSpaceAsTemplate: Template }>(
      'mutation($w: ID!, $s: ID!) { saveSpaceAsTemplate(workspaceId: $w, spaceId: $s, input: { name: "Our way", includeContent: true }) { id name builtIn counts { statuses customFields folders lists tasks docs } content } }',
      vars({ s: ws.spaceId }),
    );
    expect(saved).toMatchObject({ name: 'Our way', builtIn: false, counts: { statuses: 5, lists: 1 } });

    const { importTemplate } = await ws.owner.data<{ importTemplate: Template }>(
      'mutation($w: ID!, $input: ImportTemplateInput!) { importTemplate(workspaceId: $w, input: $input) { id name counts { lists } } }',
      vars({ input: { name: 'Imported', json: JSON.stringify({ name: 'Our way', content: saved.content }) } }),
    );
    expect(importTemplate.counts.lists).toBe(1);
    const { createSpaceFromTemplate } = await ws.owner.data<{ createSpaceFromTemplate: { name: string } }>(APPLY, vars({ t: importTemplate.id, input: { name: 'From file' } }));
    expect(createSpaceFromTemplate.name).toBe('From file');
  });

  it('rejects files that are not templates, and keeps built-ins', async () => {
    const importBad = (json: string) => ws.owner.error('mutation($w: ID!, $input: ImportTemplateInput!) { importTemplate(workspaceId: $w, input: $input) { id } }', vars({ input: { name: 'Bad', json } }));
    expect((await importBad('not json')).message).toMatch(/valid JSON/);
    expect((await importBad(JSON.stringify({ version: 1, lists: [{ name: 'x' }], tasks: [{ title: 'y', list: 9 }] }))).message).toMatch(/tasks\[0\]\.list/);
    expect((await importBad(JSON.stringify({ version: 1, space: { icon: 'javascript:alert(1)' } }))).message).toMatch(/icon/);
    expect((await ws.owner.error('mutation($w: ID!) { createSpaceFromTemplate(workspaceId: $w, templateId: "builtin:nope", input: { name: "x" }) { id } }', vars())).code).toBe('NOT_FOUND');
  });
});
