import { RouterProvider } from '@tanstack/react-router';
import { useState } from 'react';
import { formSchemasQuery } from '@/core/forms/use-form-schema';
import { Providers } from './providers';
import { createQueryClient } from './query-client';
import { createAppRouter } from './routes';

export function App() {
  const [queryClient] = useState(() => {
    const client = createQueryClient();
    // Form rules come from the API; load them up front so the first form validates instantly.
    void client.prefetchQuery(formSchemasQuery);
    return client;
  });
  const [router] = useState(() => createAppRouter(queryClient));
  return (
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  );
}
