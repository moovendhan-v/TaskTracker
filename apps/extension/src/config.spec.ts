import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { normalizeServer } from './config.js';
import { challengeFor, createVerifier } from './pkce.js';

describe('extension config', () => {
  it('accepts HTTPS TaskFlow addresses (and plain http only on this computer)', () => {
    expect(normalizeServer('taskflow.example.com')).toBe('https://taskflow.example.com');
    expect(normalizeServer('https://taskflow.example.com/w/123?x=1')).toBe('https://taskflow.example.com');
    expect(normalizeServer('http://localhost:5173')).toBe('http://localhost:5173');
    expect(normalizeServer('http://taskflow.example.com')).toBeNull();
    expect(normalizeServer('https://user:pass@taskflow.example.com')).toBeNull();
    expect(normalizeServer('javascript:alert(1)')).toBeNull();
    expect(normalizeServer('  ')).toBeNull();
  });

  it('makes RFC 7636 S256 challenges', async () => {
    const verifier = createVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createVerifier()).not.toBe(verifier);
    // The same challenge the TaskFlow server computes (SHA-256, base64url without padding).
    expect(await challengeFor(verifier)).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(await challengeFor(verifier)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
