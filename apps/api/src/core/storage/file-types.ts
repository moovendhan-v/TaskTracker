/** Bytes read from the start of an upload to decide what it really is. */
export const SNIFF_BYTES = 4_096;

export interface DetectedType {
  contentType: string;
  /** Images show in the page; everything else downloads. */
  inline: boolean;
}

const starts = (head: Buffer, bytes: number[], offset = 0) => bytes.every((byte, index) => head[offset + index] === byte);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

const extensionOf = (fileName: string) => (/\.([a-z0-9]{1,8})$/i.exec(fileName)?.[1] ?? '').toLowerCase();

/** Extensions people may upload, by the kind of content they must contain. */
export const UPLOAD_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'zip', 'docx', 'xlsx', 'pptx', 'txt', 'csv', 'md', 'log', 'json'] as const;

export function isAllowedExtension(fileName: string): boolean {
  return (UPLOAD_EXTENSIONS as readonly string[]).includes(extensionOf(fileName));
}

function isUtf8Text(head: Buffer): boolean {
  if (head.includes(0)) return false;
  // A multi-byte character may be cut off at the end of the sample.
  for (let trim = 0; trim <= 3 && trim <= head.length; trim++) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(head.subarray(0, head.length - trim));
      return true;
    } catch {
      // try a shorter sample
    }
  }
  return false;
}

/**
 * What an upload is, from its first bytes (magic numbers) and its extension
 * together. Anything that doesn't match an allowed kind, HTML and SVG
 * included, is refused (null). Text is always served as plain text.
 */
export function detectFileType(head: Buffer, fileName: string): DetectedType | null {
  const extension = extensionOf(fileName);
  if (starts(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return extension === 'png' ? { contentType: 'image/png', inline: true } : null;
  if (starts(head, [0xff, 0xd8, 0xff])) return extension === 'jpg' || extension === 'jpeg' ? { contentType: 'image/jpeg', inline: true } : null;
  if (starts(head, ascii('GIF87a')) || starts(head, ascii('GIF89a'))) return extension === 'gif' ? { contentType: 'image/gif', inline: true } : null;
  if (starts(head, ascii('RIFF')) && starts(head, ascii('WEBP'), 8)) return extension === 'webp' ? { contentType: 'image/webp', inline: true } : null;
  if (starts(head, ascii('%PDF-'))) return extension === 'pdf' ? { contentType: 'application/pdf', inline: false } : null;
  if (starts(head, [0x50, 0x4b, 0x03, 0x04])) {
    const office: Record<string, string> = {
      zip: 'application/zip',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    return office[extension] ? { contentType: office[extension]!, inline: false } : null;
  }
  if (['txt', 'csv', 'md', 'log', 'json'].includes(extension) && head.length > 0 && isUtf8Text(head)) {
    return { contentType: extension === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8', inline: false };
  }
  return null;
}

/** A file name safe to show and to put in a Content-Disposition header: no paths, no control characters. */
export function cleanFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const cleaned = [...base]
    .filter((char) => char.charCodeAt(0) > 0x1f && char.charCodeAt(0) !== 0x7f && !'"<>|:*?'.includes(char))
    .join('')
    .trim()
    .slice(-120);
  return cleaned || 'file';
}
