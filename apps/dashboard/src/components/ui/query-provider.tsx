"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/** One QueryClient per browser tab (not per render) — created inside
 * useState's initializer so React Strict Mode's double-render in
 * development doesn't spin up a second client. Server Components handle
 * the initial page-load fetch (see lib/api/*.ts); React Query only owns
 * client-side mutations and any data that needs to refetch after one
 * (product edits, inventory adjustments, branding updates). */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
