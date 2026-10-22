import { describe, expect, it } from 'vitest';
import { MarkdownSanitizer } from './markdown.sanitizer.js';

const sanitizer = new MarkdownSanitizer();

describe('MarkdownSanitizer', () => {
  it('keeps ordinary markdown, including code with < and &', () => {
    const text = '# Title\n\n- item & more\n\n```ts\nif (a < b && c) {}\n```\n[docs](https://example.com)';
    expect(sanitizer.sanitize(text)).toBe(text);
  });

  it('neutralises unsafe link schemes in every link form', () => {
    expect(sanitizer.sanitize('[x](javascript:alert(1))')).not.toMatch(/javascript:/i);
    expect(sanitizer.sanitize('[x]( JavaScript :alert(1))')).not.toMatch(/javascript\s*:/i);
    expect(sanitizer.sanitize('![i](data:text/html;base64,AAAA)')).not.toMatch(/data:/i);
    expect(sanitizer.sanitize('<vbscript:msgbox(1)>')).not.toMatch(/vbscript:/i);
    expect(sanitizer.sanitize('[ref]: javascript:alert(1)')).not.toMatch(/javascript:/i);
  });

  it('normalises line endings and strips control characters', () => {
    expect(sanitizer.sanitize('a\r\nb\u0000c\u0007')).toBe('a\nbc');
  });
});
