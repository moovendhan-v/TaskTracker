import { z } from 'zod';

const csv = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Runtime role: data access only, subject to row-level security. */
  DATABASE_URL: z.string().url(),
  /** Owner role used by `migration:run` for DDL. Falls back to DATABASE_URL for single-role local setups. */
  MIGRATION_DATABASE_URL: z.string().url().optional(),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url(),
  CORS_ORIGINS: csv,
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // An empty value (as in .env.example) means unset.
  TURNSTILE_SECRET_KEY: z.preprocess((value) => (value === '' ? undefined : value), z.string().trim().min(1).optional()),
})
  // Public forms need a CAPTCHA in production (AGENTS.md rule 11), so a missing secret fails startup.
  .refine((env) => env.NODE_ENV !== 'production' || env.TURNSTILE_SECRET_KEY !== undefined, {
    path: ['TURNSTILE_SECRET_KEY'],
    message: 'TURNSTILE_SECRET_KEY is required when NODE_ENV=production',
  });

export type Env = z.infer<typeof envSchema>;

/** Parses process.env once at startup and fails fast on missing or invalid values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }
  return result.data;
}
