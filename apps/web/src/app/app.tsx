import { RouterProvider } from '@tanstack/react-router';
import { useState } from 'react';
import { formSchemasQuery } from '@/core/forms/use-form-schema';
import { OfflineBanner } from '@/core/layout/offline-banner';
import { Providers } from './providers';
import { createQueryClient } from './query-client';
import { setAppNavigate } from '@/lib/navigate';
import { createAppRouter } from './routes';

export function App() {
  const [queryClient] = useState(() => {
    const client = createQueryClient();
    // Form rules come from the API; load them up front so the first form validates instantly.
    void client.prefetchQuery(formSchemasQuery);
    return client;
  });
  const [router] = useState(() => {
    const created = createAppRouter(queryClient);
    setAppNavigate((href) => void created.navigate({ href }));
    return created;
  });
  return (
    <Providers queryClient={queryClient}>
      <OfflineBanner />
      <RouterProvider router={router} />
    </Providers>
  );
}
