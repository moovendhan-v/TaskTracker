/**
 * md2slides (https://md2slides.cybertechmind.com, open source): a slide deck from one Markdown
 * file. TaskFlow reads its community templates, contributors, snippets and syntax guide from the
 * md2slides project itself, so what contributors add there shows up here without a TaskFlow change.
 */
export interface Md2SlidesTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  /** The contributor's GitHub handle, for credit. */
  authorGithub: string | null;
  /** The deck's Markdown. */
  md: string;
  accent: string | null;
}

export interface Md2SlidesContributor {
  github: string;
  name: string;
  role: string;
  /** How many community templates they made. */
  templates: number;
  website: string | null;
}

export interface Md2SlidesSnippet {
  label: string;
  category: string;
  md: string;
}

export interface Md2SlidesCatalogResponse {
  templates: Md2SlidesTemplate[];
  /** Most templates first. */
  contributors: Md2SlidesContributor[];
  snippets: Md2SlidesSnippet[];
  /** "live" when read from md2slides within the last day; "snapshot" when the bundled copy is used. */
  source: 'live' | 'snapshot';
  updatedAt: string;
}

export const MD2SLIDES_VIEWER_URL = 'https://md2slides.cybertechmind.com/v';
