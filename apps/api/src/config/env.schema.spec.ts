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

  const production = { ...base, NODE_ENV: 'production', SMTP_URL: 'smtps://user:pw@smtp.example.com:465', MAIL_FROM: 'TaskFlow <no-reply@example.com>' };

  it('requires a CAPTCHA secret in production', () => {
    expect(() => loadEnv(production)).toThrow(/TURNSTILE_SECRET_KEY is required/);
    expect(() => loadEnv({ ...production, TURNSTILE_SECRET_KEY: '' })).toThrow(/TURNSTILE_SECRET_KEY/);
    expect(loadEnv({ ...production, TURNSTILE_SECRET_KEY: 'secret' }).TURNSTILE_SECRET_KEY).toBe('secret');
  });

  it('requires outgoing mail in production', () => {
    const withCaptcha = { ...production, TURNSTILE_SECRET_KEY: 'secret' };
    expect(() => loadEnv({ ...withCaptcha, SMTP_URL: '' })).toThrow(/SMTP_URL and MAIL_FROM are required/);
    expect(() => loadEnv({ ...withCaptcha, SMTP_URL: 'https://mail.example.com' })).toThrow(/smtp:\/\/ or smtps:\/\//);
    expect(loadEnv({ ...withCaptcha }).MAIL_FROM).toBe('TaskFlow <no-reply@example.com>');
  });

  it('rejects a short auth secret', () => {
    expect(() => loadEnv({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
