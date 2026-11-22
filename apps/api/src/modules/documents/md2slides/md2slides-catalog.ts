import type { Md2SlidesContributor, Md2SlidesSnippet, Md2SlidesTemplate } from '@taskflow/shared-types';

/** What TaskFlow uses from md2slides; built only from validated input. */
export interface Md2SlidesCatalog {
  templates: Md2SlidesTemplate[];
  contributors: Md2SlidesContributor[];
  snippets: Md2SlidesSnippet[];
  /** md2slides' syntax guide for models (llms-full.txt), for AI drafting. */
  syntax: string;
}

/** The files read from the md2slides project, relative to its source root. */
export const MD2SLIDES_FILES = {
  community: 'src/data/community.generated.json',
  snippets: 'src/data/snippets.json',
  syntax: 'public/llms-full.txt',
} as const;

const LIMITS = { templates: 500, contributors: 500, snippets: 300, md: 20_000, snippetMd: 4_000, syntax: 200_000 } as const;
const HANDLE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const HEX = /^#[0-9a-fA-F]{3,8}$/;

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const count = (value: unknown): number => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0);
const httpsUrl = (value: unknown): string | null => {
  const raw = text(value, 300);
  try {
    return raw && new URL(raw).protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
};

/**
 * md2slides' files are someone else's input (anyone can contribute a template), so they're read
 * defensively: unknown shapes are skipped, sizes are capped, handles and URLs are checked. The
 * Markdown itself goes through TaskFlow's sanitizer like any page when someone uses a template.
 */
export function parseCommunity(body: unknown): Pick<Md2SlidesCatalog, 'templates' | 'contributors'> {
  const seen = new Set<string>();
  const templates = list(record(body)['templates'])
    .slice(0, LIMITS.templates)
    .flatMap((item): Md2SlidesTemplate[] => {
      const template = record(item);
      const id = text(template['id'], 81);
      const name = text(template['name'], 80);
      const md = typeof template['md'] === 'string' ? template['md'].slice(0, LIMITS.md) : '';
      if (!ID.test(id) || !name || !md.trim() || seen.has(id)) return [];
      seen.add(id);
      const handle = text(template['authorGithub'], 39);
      const accent = text(record(template['look'])['accent'], 9);
      return [
        {
          id,
          name,
          description: text(template['description'], 300),
          category: text(template['cat'], 40) || 'Other',
          author: text(template['author'], 80) || handle || 'md2slides community',
          authorGithub: HANDLE.test(handle) ? handle : null,
          md,
          accent: HEX.test(accent) ? accent : null,
        },
      ];
    });
  const contributors = list(record(body)['contributors'])
    .slice(0, LIMITS.contributors)
    .flatMap((item): Md2SlidesContributor[] => {
      const person = record(item);
      const github = text(person['github'], 39);
      if (!HANDLE.test(github)) return [];
      return [{ github, name: text(person['name'], 80) || github, role: text(person['role'], 60) || 'Contributor', templates: count(person['templates']), website: httpsUrl(person['website']) }];
    })
    // Those who made the most come first; ties by name, so the order is stable.
    .sort((a, b) => b.templates - a.templates || a.name.localeCompare(b.name));
  return { templates, contributors };
}

export function parseSnippets(body: unknown): Md2SlidesSnippet[] {
  return list(body)
    .slice(0, LIMITS.snippets)
    .flatMap((item): Md2SlidesSnippet[] => {
      const snippet = record(item);
      const label = text(snippet['label'], 60);
      const md = typeof snippet['md'] === 'string' ? snippet['md'].slice(0, LIMITS.snippetMd) : '';
      return label && md.trim() ? [{ label, category: text(snippet['cat'], 40) || 'Other', md }] : [];
    });
}

export function parseSyntax(body: unknown): string {
  return typeof body === 'string' ? body.slice(0, LIMITS.syntax) : '';
}

/** A catalog worth serving: md2slides always has templates and snippets, so an empty one means a bad read. */
export function isUsable(catalog: Md2SlidesCatalog): boolean {
  return catalog.templates.length > 0 && catalog.snippets.length > 0;
}
