import { RouterProvider } from '@tanstack/react-router';
import { useState } from 'react';
import { Providers } from './providers';
import { createQueryClient } from './query-client';
import { createAppRouter } from './routes';

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(() => createAppRouter(queryClient));
  return (
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  );
}
