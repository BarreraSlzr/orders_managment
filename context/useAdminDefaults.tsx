"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQuery } from "@tanstack/react-query";

export interface AdminDefaults {
  defaultPaymentOptionId: number; // 1=Cash, 2=Transfer, 3=Card, etc.
  defaultIsTakeaway: boolean;
}

interface AdminDefaultsContextType {
  defaults: AdminDefaults | null;
  isLoading: boolean;
  updateDefaults: (updates: Partial<AdminDefaults>) => Promise<void>;
}

const AdminDefaultsContext = createContext<
  AdminDefaultsContextType | undefined
>(undefined);

export function AdminDefaultsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const trpc = useTRPC();
  const [localDefaults, setLocalDefaults] = useState<AdminDefaults | null>(
    null,
  );

  // Fetch admin defaults lazily on mount
  const defaultsQuery = useQuery(trpc.admin.getDefaults.queryOptions());

  const updateDefaultsMutation = useMutation(
    trpc.admin.updateDefaults.mutationOptions(),
  );

  // Sync fetched defaults to local state
  useEffect(() => {
    if (defaultsQuery.data) {
      setLocalDefaults({
        defaultPaymentOptionId: defaultsQuery.data.defaultPaymentOptionId ?? 3,
        defaultIsTakeaway: defaultsQuery.data.defaultIsTakeaway ?? false,
      });
    }
  }, [defaultsQuery.data]);

  const handleUpdateDefaults = async (updates: Partial<AdminDefaults>) => {
    // Optimistic update on client
    setLocalDefaults(
      (prev) =>
        ({
          ...prev,
          ...updates,
        } as AdminDefaults),
    );

    // Lazy sync to server (fire and forget, don't block UI)
    try {
      await updateDefaultsMutation.mutateAsync(updates);
    } catch (error) {
      console.error("Failed to sync defaults to server:", error);
      // Revert on error
      if (defaultsQuery.data) {
        setLocalDefaults(defaultsQuery.data);
      }
    }
  };

  return (
    <AdminDefaultsContext.Provider
      value={{
        defaults: localDefaults,
        isLoading: defaultsQuery.isLoading,
        updateDefaults: handleUpdateDefaults,
      }}
    >
      {children}
    </AdminDefaultsContext.Provider>
  );
}

export function useAdminDefaults(): AdminDefaultsContextType {
  const context = useContext(AdminDefaultsContext);
  if (!context) {
    throw new Error(
      "useAdminDefaults must be used within AdminDefaultsProvider",
    );
  }
  return context;
}
