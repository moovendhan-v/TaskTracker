// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Builds a no-restricted-imports rule from `[regex, reason]` pairs matched against the import path. */
function forbidImports(...rules) {
  return ['error', { patterns: rules.map(([regex, message]) => ({ regex, message })) }];
}

const API_LAYERS = 'Layers point inward: presentation → application → domain ← infrastructure (docs/architecture/FOLDER_STRUCTURE.md).';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/coverage/**',
      'infra/terraform/.terraform/**',
      'apps/web/playwright-report/**',
      'apps/web/test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Async mistakes that silently skip work or checks.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Dangerous sinks (AGENTS.md A05).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },

  {
    // Build tooling that isn't part of any tsconfig project.
    files: ['**/*.{js,mjs}', '**/vitest*.config.ts', '**/playwright.config.ts'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { ...tseslint.configs.disableTypeChecked.languageOptions, globals: globals.node },
  },

  // ── API: NestJS decorators need runtime imports for DI tokens, so keep `import { X }` there.
  {
    files: ['apps/api/src/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
  {
    files: ['apps/api/src/modules/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': forbidImports(
        ['^@nestjs/', `Domain code is plain TypeScript. ${API_LAYERS}`],
        ['^typeorm$', `Domain code knows nothing about the database. ${API_LAYERS}`],
        ['/(application|infrastructure|presentation)/', API_LAYERS],
      ),
    },
  },
  {
    files: ['apps/api/src/modules/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': forbidImports(
        ['^typeorm$', `Services depend on repository ports, not TypeORM. ${API_LAYERS}`],
        ['/(infrastructure|presentation)/', API_LAYERS],
      ),
    },
  },
  {
    files: ['apps/api/src/modules/**/infrastructure/**/*.ts'],
    rules: { 'no-restricted-imports': forbidImports(['/presentation/', API_LAYERS]) },
  },
  {
    files: ['apps/api/src/modules/**/presentation/**/*.ts'],
    rules: {
      'no-restricted-imports': forbidImports(
        ['^typeorm$', `Resolvers call services, never the database. ${API_LAYERS}`],
        ['/infrastructure/', API_LAYERS],
      ),
    },
  },
  {
    files: ['apps/api/src/core/**/*.ts'],
    // orm-entities.ts lists every entity because TypeORM needs them all at startup.
    ignores: ['apps/api/src/core/database/orm-entities.ts'],
    rules: {
      'no-restricted-imports': forbidImports([
        '/modules/',
        'Core never imports feature modules. Define a port in core and bind an adapter in app.module.ts.',
      ]),
    },
  },

  // ── Web
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ['apps/web/src/components/**/*.{ts,tsx}', 'apps/web/src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': forbidImports(
        ['^@/modules/', 'Shared components and helpers must not depend on feature modules.'],
        ['^@/core/api/', 'Shared components get data through props; only feature modules call the API.'],
      ),
    },
  },
  {
    files: ['apps/web/src/modules/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/modules/*/api/**'],
    rules: {
      'no-restricted-imports': forbidImports(
        ['^@/modules/[^/]+/.+', "Import another module through its index (`@/modules/<name>`), not its internal files."],
        ['^@taskflow/sdk$', 'Only a module\'s api/*.api.ts calls the SDK; hooks and components go through it.'],
      ),
    },
  },
  {
    files: ['apps/web/src/modules/*/api/**/*.ts'],
    rules: {
      'no-restricted-imports': forbidImports([
        '^@/modules/[^/]+/.+',
        "Import another module through its index (`@/modules/<name>`), not its internal files.",
      ]),
    },
  },
);
