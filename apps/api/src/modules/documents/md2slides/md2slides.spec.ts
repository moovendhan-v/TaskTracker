import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.schema.js';
import type { Clock } from '../../../core/time/clock.port.js';
import { parseCommunity, parseSnippets } from './md2slides-catalog.js';
import { Md2SlidesService } from './md2slides.service.js';
import { MD2SLIDES_SNAPSHOT } from './md2slides-snapshot.generated.js';

const community = {
  templates: [
    { id: 'big-number', name: 'Big number', description: 'One stat', cat: 'Data', author: 'Ana', authorGithub: 'ana-dev', md: '# 42', look: { accent: '#ff0000' }, html: '<div onclick="x()"></div>' },
    { id: 'Bad ID!', name: 'x', md: '# x' },
    { id: 'no-md', name: 'Empty', md: '   ' },
    { id: 'big-number', name: 'Duplicate', md: '# dup' },
    { id: 'evil', name: 'Evil', md: '# hi', authorGithub: '../../etc', look: { accent: 'red;background:url(x)' } },
  ],
  contributors: [
    { github: 'ana-dev', name: 'Ana', role: 'Template author', templates: 3, website: 'javascript:alert(1)' },
    { github: 'bo', name: 'Bo', role: 'Maintainer', templates: 12, website: 'https://bo.dev' },
    { github: 'not a handle', templates: 99 },
  ],
};

describe('md2slides catalog parsing', () => {
  it('keeps valid templates only, drops HTML layouts and unsafe fields, and credits authors', () => {
    const { templates } = parseCommunity(community);
    expect(templates.map((template) => template.id)).toEqual(['big-number', 'evil']);
    expect(templates[0]).toEqual({ id: 'big-number', name: 'Big number', description: 'One stat', category: 'Data', author: 'Ana', authorGithub: 'ana-dev', md: '# 42', accent: '#ff0000' });
    expect(templates[1]).toMatchObject({ authorGithub: null, accent: null });
    expect(JSON.stringify(templates)).not.toContain('onclick');
  });

  it('ranks contributors by how many templates they made, with safe links only', () => {
    const { contributors } = parseCommunity(community);
    expect(contributors.map((person) => [person.github, person.templates])).toEqual([
      ['bo', 12],
      ['ana-dev', 3],
    ]);
    expect(contributors.find((person) => person.github === 'ana-dev')?.website).toBeNull();
  });

  it('reads snippets and the bundled snapshot', () => {
    expect(parseSnippets([{ label: 'Cards', cat: 'Blocks', md: ':::cards\n- a | b | c\n:::' }, { label: '', md: 'x' }, 'junk'])).toEqual([{ label: 'Cards', category: 'Blocks', md: ':::cards\n- a | b | c\n:::' }]);
    const snapshot = parseCommunity(MD2SLIDES_SNAPSHOT.community);
    expect(snapshot.templates.length).toBeGreaterThan(10);
    expect(parseSnippets(MD2SLIDES_SNAPSHOT.snippets).length).toBeGreaterThan(10);
    expect(MD2SLIDES_SNAPSHOT.syntax).toContain(':::cards');
  });
});

describe('Md2SlidesService', () => {
  afterEach(() => vi.unstubAllGlobals());
  let now = new Date('2026-11-22T10:00:00Z');
  const clock = { now: () => now } as Clock;
  const service = (url: string | undefined) => new Md2SlidesService({ MD2SLIDES_SOURCE_URL: url } as Env, clock);
  const answer = (path: string) =>
    path.endsWith('community.generated.json') ? JSON.stringify(community) : path.endsWith('snippets.json') ? JSON.stringify([{ label: 'Cards', cat: 'Blocks', md: ':::cards\n:::' }]) : '# guide :::cards';

  it('reads md2slides live, then serves that for a day', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(answer(url)));
    vi.stubGlobal('fetch', fetchMock);
    const md2slides = service('https://raw.example.com/md2-slides/main');
    const first = await md2slides.catalog();
    expect(first).toMatchObject({ source: 'live', syntax: '# guide :::cards' });
    expect(first.templates.map((template) => template.id)).toEqual(['big-number', 'evil']);
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain('https://raw.example.com/md2-slides/main/src/data/community.generated.json');
    await md2slides.catalog();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    now = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    await md2slides.catalog();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('falls back to the bundled snapshot when md2slides fails, and never throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    expect(await service('https://raw.example.com/x').catalog()).toMatchObject({ source: 'snapshot' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"templates": []}')));
    expect((await service('https://raw.example.com/x').catalog()).source).toBe('snapshot');
    const offline = vi.fn();
    vi.stubGlobal('fetch', offline);
    expect((await service(undefined).catalog()).source).toBe('snapshot');
    expect(offline).not.toHaveBeenCalled();
  });
});
