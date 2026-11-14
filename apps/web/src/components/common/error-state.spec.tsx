import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { GraphQLRequestError } from '@taskflow/sdk';
import { afterEach, describe, expect, it } from 'vitest';
import { ErrorState } from './error-state';

const WORKSPACE = '22222222-2222-4222-8222-222222222222';
const SPACE = '11111111-1111-4111-8111-111111111111';

function renderAt(path: string, error: unknown) {
  const rootRoute = createRootRoute({ component: () => <ErrorState error={error} /> });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: [path] }) });
  return render(<RouterProvider router={router} />);
}

describe('ErrorState for a refusal', () => {
  afterEach(cleanup);
  it('names the missing permission and links "Why?" to the access checker on it', async () => {
    const error = new GraphQLRequestError([{ message: 'Your role can’t use doc.create in this space', extensions: { code: 'FORBIDDEN', missingPermission: 'doc.create', spaceId: SPACE } }], 200);
    renderAt(`/w/${WORKSPACE}/docs`, error);
    expect(await screen.findByText('You don’t have access to this')).toBeTruthy();
    expect(screen.getByText('doc.create')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Why? Request access' });
    expect(link.getAttribute('href')).toBe(`/w/${WORKSPACE}/access?permission=doc.create&space=${SPACE}`);
  });

  it('shows the plain message for other errors', async () => {
    renderAt(`/w/${WORKSPACE}/docs`, new GraphQLRequestError([{ message: 'Task not found', extensions: { code: 'NOT_FOUND' } }], 200));
    expect(await screen.findByText('Task not found')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Why\?/ })).toBeNull();
  });
});
