// Builds the extension for Chrome and Firefox (Manifest V3) into dist/chrome and dist/firefox.
// Pages and the background are ES modules; scripts injected into web pages are self-contained IIFEs.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { zipDirectory } from './zip.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, 'src');
const out = resolve(here, 'dist/build');
const { version, description } = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8'));

rmSync(resolve(here, 'dist'), { recursive: true, force: true });

await build({
  root: src,
  base: './',
  logLevel: 'warn',
  configFile: false,
  build: {
    outDir: out,
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    sourcemap: false,
    rollupOptions: {
      input: { popup: resolve(src, 'popup.html'), report: resolve(src, 'report.html'), background: resolve(src, 'background.ts') },
      output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js', assetFileNames: 'assets/[name]-[hash][extname]' },
    },
  },
});

for (const name of ['recorder', 'picker']) {
  await build({
    root: src,
    logLevel: 'warn',
    configFile: false,
    build: {
      outDir: resolve(out, 'inject'),
      emptyOutDir: false,
      target: 'es2020',
      lib: { entry: resolve(src, `inject/${name}.ts`), formats: ['iife'], name: `taskflow_${name}`, fileName: () => `${name}.js` },
    },
  });
}

const common = {
  manifest_version: 3,
  name: 'TaskFlow bug reporter',
  short_name: 'TaskFlow',
  version,
  description,
  action: { default_popup: 'popup.html', default_title: 'Report a bug to TaskFlow' },
  // activeTab: screenshot and read the page you report on, only when you click the extension.
  permissions: ['activeTab', 'scripting', 'storage', 'alarms'],
  // Your TaskFlow address, and (only if you turn on "capture on every site") all sites.
  optional_host_permissions: ['http://*/*', 'https://*/*'],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'none'; base-uri 'none'" },
};

const manifests = {
  chrome: { ...common, background: { service_worker: 'background.js', type: 'module' }, minimum_chrome_version: '116' },
  firefox: {
    ...common,
    background: { scripts: ['background.js'], type: 'module' },
    browser_specific_settings: { gecko: { id: 'bug-reporter@taskflow.app', strict_min_version: '128.0' } },
  },
};

for (const [browser, manifest] of Object.entries(manifests)) {
  const target = resolve(here, 'dist', browser);
  mkdirSync(target, { recursive: true });
  cpSync(out, target, { recursive: true });
  writeFileSync(resolve(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
rmSync(out, { recursive: true, force: true });

// Packages TaskFlow serves at /downloads/extension/ (see apps/web): one per browser, plus what's latest.
const packages = resolve(here, 'dist/packages');
mkdirSync(packages, { recursive: true });
const latest = { version, builtAt: new Date().toISOString(), files: {} };
for (const browser of Object.keys(manifests)) {
  const file = `taskflow-extension-${browser}-${version}.zip`;
  zipDirectory(resolve(here, 'dist', browser), resolve(packages, file));
  // The same bytes under a name that never changes, for /downloads/extension/latest.
  cpSync(resolve(packages, file), resolve(packages, `taskflow-extension-${browser}.zip`));
  latest.files[browser] = file;
}
writeFileSync(resolve(packages, 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`);
console.log(`Built dist/chrome, dist/firefox and dist/packages (${version})`);
