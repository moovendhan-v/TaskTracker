import type { StatusCategory } from './task.js';

/** Letters and digits, starting with a letter: TF, WEB, OPS2. Pull requests mention tasks as <PREFIX>-<number>. */
export const TASK_PREFIX_PATTERN = '^[A-Z][A-Z0-9]{0,9}$';
export const DEFAULT_TASK_PREFIX = 'TF';
export const REPO_PATTERN = '^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$';

export const PULL_REQUEST_STATES = ['open', 'merged', 'closed'] as const;
export type PullRequestState = (typeof PULL_REQUEST_STATES)[number];

/** What a connection does to linked tasks, beyond automations: move them to the first status with this meaning. */
export interface GithubSyncSettings {
  onOpened: StatusCategory | null;
  onMerged: StatusCategory | null;
}

export const DEFAULT_GITHUB_SYNC: GithubSyncSettings = { onOpened: 'review', onMerged: 'done' };

/** Task numbers a pull request mentions, e.g. "TF-42 fix login" or branch "tf-42-login". */
export function taskReferences(prefix: string, ...texts: readonly (string | null | undefined)[]): number[] {
  const pattern = new RegExp(`(?:^|[^A-Za-z0-9])${prefix}-(\\d{1,9})(?![A-Za-z0-9])`, 'gi');
  const numbers = new Set<number>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.slice(0, 100_000).matchAll(pattern)) {
      numbers.add(Number(match[1]));
      if (numbers.size >= 20) return [...numbers];
    }
  }
  return [...numbers];
}
