import { describe, expect, it } from 'vitest';
import { GraphQLRequestError } from '@taskflow/sdk';
import { missingPermissionOf, whyHref, workspaceInPath } from './errors';

const forbidden = (extensions: Record<string, unknown>) => new GraphQLRequestError([{ message: 'Missing workspace permission', extensions: { code: 'FORBIDDEN', ...extensions } }], 200);
const SPACE = '11111111-1111-4111-8111-111111111111';

describe('why a request was refused', () => {
  it('reads the missing permission (and project) from a FORBIDDEN error', () => {
    expect(missingPermissionOf(forbidden({ missingPermission: 'task.delete' }))).toEqual({ permission: 'task.delete', spaceId: null });
    expect(missingPermissionOf(forbidden({ missingPermission: 'doc.create', spaceId: SPACE }))).toEqual({ permission: 'doc.create', spaceId: SPACE });
    // Not said, malformed, or not a refusal: nothing to explain.
    expect(missingPermissionOf(forbidden({}))).toBeNull();
    expect(missingPermissionOf(forbidden({ missingPermission: '<script>' }))).toBeNull();
    expect(missingPermissionOf(new GraphQLRequestError([{ message: 'Nope', extensions: { code: 'NOT_FOUND', missingPermission: 'task.view' } }], 200))).toBeNull();
    expect(missingPermissionOf(new Error('boom'))).toBeNull();
  });

  it('links to the access checker for that permission', () => {
    expect(whyHref('w1', { permission: 'task.delete', spaceId: null })).toBe('/w/w1/access?permission=task.delete');
    expect(whyHref('w1', { permission: 'doc.create', spaceId: SPACE })).toBe(`/w/w1/access?permission=doc.create&space=${SPACE}`);
    expect(workspaceInPath(`/w/${SPACE}/docs`)).toBe(SPACE);
    expect(workspaceInPath('/sign-in')).toBeNull();
  });
});
