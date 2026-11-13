import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import { SecretBox } from './secret-box.js';

const box = (secret: string) => new SecretBox({ BETTER_AUTH_SECRET: secret } as Env);

describe('SecretBox', () => {
  it('round-trips, with a different ciphertext every time', () => {
    const one = box('x'.repeat(40));
    const a = one.seal('webhook-secret');
    expect(a).not.toBe(one.seal('webhook-secret'));
    expect(one.open(a)).toBe('webhook-secret');
  });

  it('refuses tampered values and other keys', () => {
    const sealed = box('x'.repeat(40)).seal('webhook-secret');
    expect(() => box('y'.repeat(40)).open(sealed)).toThrow();
    const [v, iv, tag, data] = sealed.split('.');
    // Change the first character for sure (setting it to a fixed one did nothing when it already was that one).
    const tampered = `${data![0] === 'A' ? 'B' : 'A'}${data!.slice(1)}`;
    expect(() => box('x'.repeat(40)).open([v, iv, tag, tampered].join('.'))).toThrow();
  });
});
