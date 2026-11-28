import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// The embeddable feedback widget (E6.3), built by @taskflow/feedback-widget, served by TaskFlow at
// /embed/v1/feedback.js: from the package in development, copied into the build for nginx.
const WIDGET_PATH = '/embed/v1/feedback.js';
const widgetFile = fileURLToPath(new URL('../../packages/feedback-widget/dist/feedback.js', import.meta.url));
function feedbackWidget(): Plugin {
  return {
    name: 'taskflow-feedback-widget',
    configureServer(server) {
      server.middlewares.use(WIDGET_PATH, (_request, response) => {
        if (!existsSync(widgetFile)) {
          response.statusCode = 404;
          response.end('Build @taskflow/feedback-widget first');
          return;
        }
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache');
        response.end(readFileSync(widgetFile));
      });
    },
    generateBundle() {
      if (!existsSync(widgetFile)) this.error('Build @taskflow/feedback-widget before the web app (pnpm build does it in order)');
      this.emitFile({ type: 'asset', fileName: WIDGET_PATH.slice(1), source: readFileSync(widgetFile) });
    },
  };
}

// Docker dev (scripts/dev.sh) publishes Vite on DEV_WEB_PORT, so the browser must open the
// HMR socket there. Everywhere else (plain `pnpm dev`, CI, Playwright) Vite's own port is right.
const devWebPort = process.env.DEV_WEB_PORT ? Number(process.env.DEV_WEB_PORT) : undefined;

// The dev server proxies /api to the API, so the browser sees one origin, like nginx in production.
// The browser extension (E6.3), built by @taskflow/extension, downloadable from TaskFlow at
// /downloads/extension/. `latest` picks the package for the browser asking (or ?browser=).
const EXTENSION_PATH = '/downloads/extension/';
const extensionDir = fileURLToPath(new URL('../../apps/extension/dist/packages/', import.meta.url));
function extensionFor(userAgent: string, asked: string | null): 'chrome' | 'firefox' {
  if (asked === 'firefox' || asked === 'chrome') return asked;
  return /Firefox\/|FxiOS\//.test(userAgent) ? 'firefox' : 'chrome';
}
function extensionDownloads(): Plugin {
  return {
    name: 'taskflow-extension-downloads',
    configureServer(server) {
      server.middlewares.use(EXTENSION_PATH, (request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        const name = url.pathname.replace(/^\//, '');
        if (name === 'latest') {
          response.statusCode = 302;
          response.setHeader('Location', `${EXTENSION_PATH}taskflow-extension-${extensionFor(request.headers['user-agent'] ?? '', url.searchParams.get('browser'))}.zip`);
          response.end();
          return;
        }
        const file = `${extensionDir}${name}`;
        if (!/^[\w.-]+\.(zip|json)$/.test(name) || !existsSync(file)) {
          response.statusCode = 404;
          response.end('Not found (build @taskflow/extension first)');
          return;
        }
        response.setHeader('Content-Type', name.endsWith('.json') ? 'application/json' : 'application/zip');
        if (name.endsWith('.zip')) response.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        response.setHeader('Cache-Control', 'no-cache');
        response.end(readFileSync(file));
      });
    },
    generateBundle() {
      if (!existsSync(`${extensionDir}latest.json`)) this.error('Build @taskflow/extension before the web app (pnpm build does it in order)');
      for (const name of readdirSync(extensionDir)) this.emitFile({ type: 'asset', fileName: `${EXTENSION_PATH.slice(1)}${name}`, source: readFileSync(`${extensionDir}${name}`) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), feedbackWidget(), extensionDownloads()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: devWebPort ? { clientPort: devWebPort } : true,
    proxy: {
      // ws: live updates (GraphQL subscriptions) use a WebSocket on /api/graphql.
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000', changeOrigin: false, ws: true },
    },
  },
  build: {
    sourcemap: false,
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
