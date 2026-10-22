import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.schema.js';

const base = {
  DATABASE_URL: 'postgres://app:pw@localhost:5432/taskflow',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173, https://app.example.com',
};

describe('loadEnv', () => {
  it('parses a development config and splits CORS origins', () => {
    const env = loadEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://app.example.com']);
    expect(env.TURNSTILE_SECRET_KEY).toBeUndefined();
  });

  it('requires a CAPTCHA secret in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/TURNSTILE_SECRET_KEY is required/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', TURNSTILE_SECRET_KEY: '' })).toThrow(/TURNSTILE_SECRET_KEY/);
    expect(loadEnv({ ...base, NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'secret' }).TURNSTILE_SECRET_KEY).toBe('secret');
  });

  it('rejects a short auth secret', () => {
    expect(() => loadEnv({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
