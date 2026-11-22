import { MD2SLIDES_VIEWER_URL } from '@taskflow/shared-types';

/**
 * md2slides share links (the format of md2slides' own share codec, v1): the deck travels in the
 * URL fragment as JSON → deflate-raw → base64url, behind a [version, flags] header. A fragment
 * is never sent to a server, so opening a deck uploads nothing; anyone with the link can read it.
 */
export interface Md2SlidesSharePayload {
  v: 1;
  md: string;
  path: string;
  name: string;
  created: number;
  opts: { notes: boolean; download: boolean; present: boolean };
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let text = '';
  for (let index = 0; index < bytes.length; index += 0x8000) text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function encodeMd2SlidesShare(payload: Md2SlidesSharePayload): Promise<string> {
  const packed = await deflate(new TextEncoder().encode(JSON.stringify(payload)));
  return toBase64Url(new Uint8Array([1, 0, ...packed]));
}

/** A viewer link for a deck: opens in md2slides' own player, so every syntax md2slides knows works. */
export async function md2slidesViewerUrl(markdown: string, title: string, options: { present?: boolean } = {}): Promise<string> {
  const name = title.trim() || 'TaskFlow deck';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';
  const code = await encodeMd2SlidesShare({ v: 1, md: markdown, path: `${slug}.md`, name, created: Date.now(), opts: { notes: true, download: true, present: options.present ?? false } });
  return `${MD2SLIDES_VIEWER_URL}#${code}`;
}

/** A doc as a deck: kept as is when it already has slide breaks, else each "## " section becomes a slide. */
export function docAsDeck(title: string, content: string): string {
  if (/^---\s*$/m.test(content)) return content;
  return `# ${title}\n\n${content.replace(/\n(## [^\n]+)/g, '\n---\n\n$1')}`;
}

/**
 * Opens a deck in the md2slides viewer. The tab is opened at once (inside the click, so it isn't
 * blocked as a pop-up) and pointed at the deck when the link is ready.
 */
export async function openInMd2Slides(markdown: string, title: string, options: { present?: boolean } = {}): Promise<void> {
  const tab = window.open('about:blank', '_blank');
  const url = await md2slidesViewerUrl(markdown, title, options);
  if (tab) {
    tab.opener = null;
    tab.location.href = url;
  } else {
    window.location.assign(url);
  }
}
