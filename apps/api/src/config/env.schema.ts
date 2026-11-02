import { z } from 'zod';

const csv = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

/** An optional setting where an empty value (as in .env.example) means unset. */
function optionalString<T extends z.ZodType<string>>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

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
  TURNSTILE_SECRET_KEY: optionalString(z.string().trim().min(1)),
  /** Outgoing mail for password resets, e.g. smtps://user:pass@smtp.example.com:465 */
  SMTP_URL: optionalString(z.string().url().refine((url) => /^smtps?:\/\//.test(url), 'SMTP_URL must start with smtp:// or smtps://')),
  /** Sender address, e.g. "TaskFlow <no-reply@example.com>" */
  MAIL_FROM: optionalString(z.string().trim().min(3).max(200)),
  /** Shared cache, e.g. redis://:password@redis:6379/0. Without it each instance caches in memory. */
  REDIS_URL: optionalString(z.string().url().refine((url) => /^rediss?:\/\//.test(url), 'REDIS_URL must start with redis:// or rediss://')),
  /** Where uploads go: `local` (disk, one instance only) or `s3` (AWS S3, Cloudflare R2, MinIO). */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  /** For `local`: a directory the API can write to. */
  STORAGE_LOCAL_DIR: z.string().min(1).default('.data/uploads'),
  /** For `s3`. The bucket must be private; the API streams files in and out. */
  S3_BUCKET: optionalString(z.string().trim().min(3).max(63)),
  S3_REGION: z.string().trim().min(1).default('us-east-1'),
  /** For S3-compatible services, e.g. http://minio:9000 or https://<account>.r2.cloudflarestorage.com */
  S3_ENDPOINT: optionalString(z.string().url()),
  S3_FORCE_PATH_STYLE: z.preprocess((value) => value === 'true' || value === '1' || value === true, z.boolean()).default(false),
  /** Leave both unset to use the AWS default credential chain (e.g. an instance role). */
  S3_ACCESS_KEY_ID: optionalString(z.string().trim().min(1)),
  S3_SECRET_ACCESS_KEY: optionalString(z.string().trim().min(1)),
})
  // Public forms need a CAPTCHA in production (AGENTS.md rule 11), so a missing secret fails startup.
  .refine((env) => env.NODE_ENV !== 'production' || env.TURNSTILE_SECRET_KEY !== undefined, {
    path: ['TURNSTILE_SECRET_KEY'],
    message: 'TURNSTILE_SECRET_KEY is required when NODE_ENV=production',
  })
  // Without mail, password reset silently does nothing, so production needs it configured.
  .refine((env) => env.NODE_ENV !== 'production' || (env.SMTP_URL !== undefined && env.MAIL_FROM !== undefined), {
    path: ['SMTP_URL'],
    message: 'SMTP_URL and MAIL_FROM are required when NODE_ENV=production',
  })
  // Several API instances must share one cache, or one instance keeps serving what another changed.
  .refine((env) => env.STORAGE_DRIVER !== 's3' || env.S3_BUCKET !== undefined, {
    path: ['S3_BUCKET'],
    message: 'S3_BUCKET is required when STORAGE_DRIVER=s3',
  })
  // Uploads on one instance's disk would be missing on the others, so production stores them in a bucket.
  .refine((env) => env.NODE_ENV !== 'production' || env.STORAGE_DRIVER === 's3', {
    path: ['STORAGE_DRIVER'],
    message: 'STORAGE_DRIVER=s3 is required when NODE_ENV=production',
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.REDIS_URL !== undefined, {
    path: ['REDIS_URL'],
    message: 'REDIS_URL is required when NODE_ENV=production',
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
