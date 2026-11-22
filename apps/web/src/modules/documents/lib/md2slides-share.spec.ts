// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { docAsDeck, md2slidesViewerUrl } from './md2slides-share';

/** md2slides' own decode (src/domain/share/codec.ts, v1, unencrypted), to prove the links open there. */
async function decodeLikeMd2Slides(code: string): Promise<{ v: number; md: string; name: string; path: string; opts: Record<string, boolean> }> {
  const bytes = Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((code.length + 3) % 4)), (char) => char.charCodeAt(0));
  expect([bytes[0], bytes[1]]).toEqual([1, 0]);
  const stream = new Blob([bytes.subarray(2) as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

describe('md2slides share links', () => {
  it('carry the deck in the fragment, in md2slides’ share format', async () => {
    const deck = '---\ntheme: night\n---\n^ Q4\n# Launch ✨\n:::cards cols=3\n- rocket | Fast | Ships today\n:::\n---\n# Thanks';
    const url = await md2slidesViewerUrl(deck, 'Launch plan', { present: true });
    expect(url.startsWith('https://md2slides.cybertechmind.com/v#')).toBe(true);
    const payload = await decodeLikeMd2Slides(url.split('#')[1]!);
    expect(payload).toMatchObject({ v: 1, md: deck, name: 'Launch plan', path: 'launch-plan.md', opts: { notes: true, download: true, present: true } });
  });

  it('turns a doc into slides at its ## sections, unless it already has slide breaks', () => {
    expect(docAsDeck('Plan', 'Intro\n## Goals\n- a\n## Risks\n- b')).toBe('# Plan\n\nIntro\n---\n\n## Goals\n- a\n---\n\n## Risks\n- b');
    expect(docAsDeck('Plan', '# A\n---\n# B')).toBe('# A\n---\n# B');
  });
});
