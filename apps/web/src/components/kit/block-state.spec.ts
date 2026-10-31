import { GraphQLRequestError } from '@taskflow/sdk';
import { describe, expect, it, vi } from 'vitest';
import { blockStateOf } from './block-state';

const ok = { isPending: false, isError: false, error: null };
const gqlError = (code: string, message: string) => new GraphQLRequestError([{ message, extensions: { code } }], 200);

describe('blockStateOf', () => {
  it('is loading while the first fetch runs', () => {
    expect(blockStateOf({ ...ok, isPending: true })).toEqual({ kind: 'loading' });
  });

  it('is ready, or empty when the caller says so', () => {
    expect(blockStateOf(ok)).toEqual({ kind: 'ready' });
    expect(blockStateOf(ok, { empty: { when: true, title: 'Nothing here' } })).toEqual({ kind: 'empty', title: 'Nothing here', hint: undefined });
  });

  it('turns a permission refusal into no-access, with the server message', () => {
    const state = blockStateOf({ ...ok, isError: true, error: gqlError('FORBIDDEN', 'A policy denies this space') }, { what: 'Finance' });
    expect(state).toEqual({ kind: 'no-access', title: "You can't view Finance", hint: 'A policy denies this space' });
  });

  it('offers a retry for other errors, without leaking server details', () => {
    const refetch = vi.fn();
    const state = blockStateOf({ ...ok, isError: true, error: gqlError('INTERNAL_SERVER_ERROR', 'db exploded at host 10.0.0.3'), refetch });
    expect(state).toMatchObject({ kind: 'error', title: "Couldn't load this data", hint: 'Something went wrong. Please try again.' });
    if (state.kind === 'error') state.onRetry?.();
    expect(refetch).toHaveBeenCalledOnce();
  });
});
