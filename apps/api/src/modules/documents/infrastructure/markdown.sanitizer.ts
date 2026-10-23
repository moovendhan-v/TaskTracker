import { Injectable } from '@nestjs/common';
import { ContentSanitizer } from '../domain/content-sanitizer.port.js';

/** Schemes that can run code or smuggle content when a link is followed. */
const UNSAFE_SCHEME = String.raw`(?:javascript|vbscript|data|file)\s*:`;
// [text](javascript:…) and ![alt](data:…)
const INLINE_LINK = new RegExp(String.raw`\]\(\s*<?\s*${UNSAFE_SCHEME}`, 'gi');
// <javascript:…> autolinks
const AUTOLINK = new RegExp(String.raw`<\s*${UNSAFE_SCHEME}`, 'gi');
// [ref]: javascript:… reference definitions
const REFERENCE = new RegExp(String.raw`^(\s{0,3}\[[^\]]+\]:\s*<?\s*)${UNSAFE_SCHEME}`, 'gim');
// C0 controls except tab and newline, plus DEL. Matching control characters is the point here.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Server-side cleanup for markdown pages. The web app already renders markdown
 * without raw HTML and blocks unsafe URLs; this keeps stored content clean for
 * any other client too.
 */
@Injectable()
export class MarkdownSanitizer extends ContentSanitizer {
  sanitize(markdown: string): string {
    return markdown
      .replace(/\r\n?/g, '\n')
      .replace(CONTROL_CHARS, '')
      .replace(INLINE_LINK, '](#blocked-link:')
      .replace(AUTOLINK, '<#blocked-link:')
      .replace(REFERENCE, '$1#blocked-link:');
  }
}
