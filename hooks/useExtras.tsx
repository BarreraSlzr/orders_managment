"use client";

import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";

export function useExtras() {
  const trpc = useTRPC();
  const extrasQuery = useQuery(trpc.extras.list.queryOptions());

  return {
    extras: extrasQuery.data ?? [],
    isLoading: extrasQuery.isLoading,
  };
}
