/**
 * `.tflow` files: TaskFlow things you can download and import elsewhere. One
 * JSON object with a `kind`, a `version` and the payload. The server checks
 * everything an import touches; this only reads the file and names its kind.
 */
export type TflowKind = 'project-template' | 'dashboard-layout';

export const TFLOW_ACCEPT = '.tflow,application/json,.json';
/** Larger than any valid export, so a bigger file is refused before it is read. */
export const TFLOW_BYTES_MAX = 512 * 1024;

export interface TflowFile<T> {
  kind: TflowKind;
  version: 1;
  name: string;
  payload: T;
}

/** A safe file name from a title: "Sprint health" → "sprint-health.tflow". */
export function tflowFileName(name: string): string {
  return `${name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'taskflow'}.tflow`;
}

export function downloadTflow<T>(kind: TflowKind, name: string, payload: T, extra: Record<string, unknown> = {}): void {
  const json = JSON.stringify({ kind, version: 1, name, ...extra, payload }, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = tflowFileName(name);
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Reads a `.tflow` file of the expected kind. Throws a message fit to show.
 * `legacy` accepts older files without a kind (project templates saved before .tflow).
 */
export async function readTflow(file: File, kind: TflowKind, legacy?: (raw: Record<string, unknown>) => unknown): Promise<{ name: string; payload: unknown; raw: Record<string, unknown> }> {
  if (file.size > TFLOW_BYTES_MAX) throw new Error('That file is too large');
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('That file isn’t a TaskFlow file (not valid JSON)');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('That file isn’t a TaskFlow file');
  const record = raw as Record<string, unknown>;
  const name = typeof record['name'] === 'string' ? record['name'] : file.name.replace(/\.[^.]*$/, '');
  if (record['kind'] === undefined && legacy) return { name, payload: legacy(record), raw: record };
  if (record['kind'] !== kind) throw new Error(kind === 'dashboard-layout' ? 'That file isn’t a dashboard layout' : 'That file isn’t a project template');
  if (record['version'] !== 1) throw new Error('That file is from a newer TaskFlow; update and try again');
  return { name, payload: record['payload'], raw: record };
}
