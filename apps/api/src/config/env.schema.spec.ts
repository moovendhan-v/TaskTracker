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

  const production = { ...base, NODE_ENV: 'production', SMTP_URL: 'smtps://user:pw@smtp.example.com:465', MAIL_FROM: 'TaskFlow <no-reply@example.com>', REDIS_URL: 'redis://:pw@redis:6379/0', STORAGE_DRIVER: 's3', S3_BUCKET: 'taskflow-uploads' };

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

  it('requires a shared cache in production', () => {
    const complete = { ...production, TURNSTILE_SECRET_KEY: 'secret' };
    expect(() => loadEnv({ ...complete, REDIS_URL: '' })).toThrow(/REDIS_URL is required/);
    expect(() => loadEnv({ ...complete, REDIS_URL: 'http://redis:6379' })).toThrow(/redis:\/\/ or rediss:\/\//);
    expect(loadEnv(complete).REDIS_URL).toBe('redis://:pw@redis:6379/0');
  });

  it('rejects a short auth secret', () => {
    expect(() => loadEnv({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('takes GitHub sign-in keys in pairs', () => {
    expect(loadEnv(base).GITHUB_CLIENT_ID).toBeUndefined();
    expect(() => loadEnv({ ...base, GITHUB_CLIENT_ID: 'Iv1.abc' })).toThrow(/both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET/);
    expect(() => loadEnv({ ...base, GITHUB_CLIENT_SECRET: 'secret' })).toThrow(/both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET/);
    expect(loadEnv({ ...base, GITHUB_CLIENT_ID: 'Iv1.abc', GITHUB_CLIENT_SECRET: 'secret' }).GITHUB_CLIENT_ID).toBe('Iv1.abc');
  });

  it('takes the calls media server settings all together, and secure in production', () => {
    const livekit = { LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_API_KEY: 'key', LIVEKIT_API_SECRET: 's'.repeat(32) };
    expect(loadEnv({ ...base, ...livekit }).LIVEKIT_URL).toBe('ws://localhost:7880');
    expect(() => loadEnv({ ...base, LIVEKIT_URL: 'ws://localhost:7880' })).toThrow(/LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET/);
    expect(() => loadEnv({ ...base, ...livekit, LIVEKIT_API_SECRET: 'short' })).toThrow(/LIVEKIT_API_SECRET/);
    expect(() => loadEnv({ ...base, ...livekit, LIVEKIT_URL: 'https://media.example.com' })).toThrow(/ws:\/\/ or wss:\/\//);
    const live = { ...production, TURNSTILE_SECRET_KEY: 'secret' };
    expect(() => loadEnv({ ...live, ...livekit })).toThrow(/wss:\/\/ in production/);
    expect(loadEnv({ ...live, ...livekit, LIVEKIT_URL: 'wss://media.example.com' }).LIVEKIT_URL).toBe('wss://media.example.com');
  });
});
