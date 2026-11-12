import { loadEnv } from '../config/env.schema.js';
import { checkGithubApp } from '../core/github-app/check-github-app.js';

/** Checks the GitHub App settings in .env against GitHub. Usage: pnpm --filter @taskflow/api github-app:check */
checkGithubApp(loadEnv()).then(
  (ok) => process.exit(ok ? 0 : 1),
  (error: unknown) => {
    console.error(`✗ ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  },
);
