'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Prevent automatic re-fetching when the window regains focus.
            // Dashboards use explicit filter-driven invalidation instead.
            refetchOnWindowFocus: false,
            // Treat cached data as fresh for 30 s; reduces redundant fetches
            // when the same key is used by multiple components simultaneously.
            staleTime: 30 * 1000,
            // De-duplicate in-flight requests with the same query key within
            // a 5 s window – important when multiple components mount at the
            // same time and attempt to fire the same query.
            // Note: In @tanstack/react-query v5 this is controlled by staleTime.
            retry: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
