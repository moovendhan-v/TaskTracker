import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.js';

describe('chat cursors', () => {
  it('round-trips a position with microseconds', () => {
    const position = { at: '2026-11-02 09:15:01.123456+00', id: '0f6c2a8e-3a52-4c1e-9d1a-2b3c4d5e6f70' };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it('rejects anything else', () => {
    expect(decodeCursor('nope')).toBeNull();
    expect(decodeCursor(Buffer.from("2026-11-02 09:15:01+00|x' OR 1=1").toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('yesterday|0f6c2a8e-3a52-4c1e-9d1a-2b3c4d5e6f70').toString('base64url'))).toBeNull();
    expect(decodeCursor('a'.repeat(300))).toBeNull();
  });
});
