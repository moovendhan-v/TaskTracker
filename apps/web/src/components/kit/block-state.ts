import { getErrorMessage, isForbidden } from '@/lib/errors';

/**
 * What a block's body shows. Each block owns its state, so one failing
 * block never takes the page down (v2 spec §4.3, Features #11a).
 */
export type BlockState =
  | { kind: 'ready' }
  | { kind: 'loading' }
  | { kind: 'empty'; title: string; hint?: string }
  | { kind: 'error'; title: string; hint?: string; onRetry?: () => void }
  | { kind: 'no-access'; title: string; hint?: string };

export const READY: BlockState = { kind: 'ready' };

interface QueryLike {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch?: () => unknown;
}

interface Options {
  /** Shown when the query succeeded but there's nothing to show. */
  empty?: { when: boolean; title: string; hint?: string };
  /** What the data is called in messages, e.g. "the dashboard". */
  what?: string;
}

/**
 * Maps a React Query result to a block state. A permission refusal from the
 * server becomes "no access" (with the server's safe message), not an error.
 */
export function blockStateOf(query: QueryLike, { empty, what = 'this data' }: Options = {}): BlockState {
  if (query.isError) {
    if (isForbidden(query.error)) {
      return { kind: 'no-access', title: `You can't view ${what}`, hint: getErrorMessage(query.error, 'Ask a workspace admin for access.') };
    }
    const refetch = query.refetch;
    return { kind: 'error', title: `Couldn't load ${what}`, hint: getErrorMessage(query.error), onRetry: refetch ? () => void refetch() : undefined };
  }
  if (query.isPending) return { kind: 'loading' };
  if (empty?.when) return { kind: 'empty', title: empty.title, hint: empty.hint };
  return READY;
}
