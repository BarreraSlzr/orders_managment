"use client";

import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";

/**
 * Returns `{ isAdmin }` by checking the tRPC admin.status endpoint.
 * The query is retried once and cached — cheap to call from any component.
 */
export function useAdminStatus() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery({
    ...trpc.admin.status.queryOptions(),
    retry: false,
    staleTime: 60_000, // re-check at most once per minute
  });

  return {
    isAdmin: data?.isAdmin ?? false,
    role: data?.role ?? null,
    tenantName: data?.tenantName ?? null,
    username: data?.username ?? null,
    session: data?.session ?? null,
    isLoading,
  };
}
