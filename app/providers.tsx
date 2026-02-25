"use client";

import SSEInvalidationListener from "@/components/SSE/SSEInvalidationListener";
import { AdminDefaultsProvider } from "@/context/useAdminDefaults";
import { TRPCProvider } from "@/lib/trpc/react";
import type { AppRouter } from "@/lib/trpc/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense, useState } from "react";
import superjson from "superjson";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <AdminDefaultsProvider>
          <NuqsAdapter>
            <Suspense>
              <SSEInvalidationListener />
              {children}
            </Suspense>
          </NuqsAdapter>
        </AdminDefaultsProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}
