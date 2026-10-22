import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';
import { apiProcessEnv } from './test-env.js';

const API_ROOT = resolve(import.meta.dirname, '../../..');

declare module 'vitest' {
  export interface ProvidedContext {
    apiUrl: string;
    apiEnv: NodeJS.ProcessEnv;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolvePort(address.port) : reject(new Error('No port'))));
    });
  });
}

async function waitForHealth(url: string, api: ChildProcess): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) throw new Error(`API exited with code ${api.exitCode} before it was ready`);
    const ok = await fetch(`${url}/api/health`).then((response) => response.ok, () => false);
    if (ok) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error('API did not become healthy within 60s');
}

/** Migrates the test database, starts the built API on a free port, and stops it afterwards. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const port = await freePort();
  const env = apiProcessEnv(port);

  const migrate = spawnSync('node', ['dist/cli/run-migrations.js'], { cwd: API_ROOT, env, encoding: 'utf8' });
  if (migrate.status !== 0) throw new Error(`Migrations failed:\n${migrate.stdout}\n${migrate.stderr}`);

  const output: string[] = [];
  const api = spawn('node', ['dist/main.js'], { cwd: API_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  api.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  api.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()));

  const url = `http://127.0.0.1:${port}`;
  try {
    await waitForHealth(url, api);
  } catch (error) {
    api.kill();
    throw new Error(`${(error as Error).message}\n${output.join('')}`, { cause: error });
  }

  project.provide('apiUrl', url);
  project.provide('apiEnv', env);

  return async () => {
    api.kill('SIGTERM');
    if (process.env['E2E_SHOW_API_LOG']) console.log(output.join(''));
  };
}
