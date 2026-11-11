export interface Slide {
  id: number;
  /** What the audience sees. */
  content: string;
  /** Speaker notes: markdown (task references and embeds included), shown only to the presenter. */
  notes: string;
  title: string;
}

/** A line that starts a slide's speaker notes: `Note:` or `Notes:` on its own line or followed by text. */
const NOTES_START = /^notes?:[ \t]*/im;

/**
 * Splits a page into slides at `---` lines. In each slide, everything after a `Note:` (or
 * `Notes:`) line is speaker notes, the convention most markdown slide tools share.
 */
export function parseSlides(content: string, documentTitle: string): Slide[] {
  const chunks = content
    .split(/(?:^|\n)---\s*(?:\n|$)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (chunks.length === 0) {
    return [{ id: 0, content: `# ${documentTitle || 'Untitled'}\n\nNo presentation slides yet.`, notes: '', title: documentTitle || 'Title' }];
  }
  return chunks.map((chunk, index) => {
    const found = NOTES_START.exec(chunk);
    const body = found ? chunk.slice(0, found.index).trim() : chunk;
    const notes = found ? chunk.slice(found.index + found[0].length).trim() : '';
    const heading = /^#{1,3}\s+(.+)$/m.exec(body)?.[1];
    return { id: index, content: body, notes, title: heading ?? `Slide ${index + 1}` };
  });
}
