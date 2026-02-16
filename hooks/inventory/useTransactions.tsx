import { TransactionsTable } from "@/lib/sql/types";
import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Selectable } from "kysely";
import { useCallback } from "react";
import { Item } from "./useInventoryItems";

export type Transaction = Selectable<TransactionsTable>;

export const useTransactions = (selectedItem?: Item | null) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listOpts = trpc.inventory.transactions.list.queryOptions(
    { itemId: selectedItem?.id ?? "" },
    { enabled: !!selectedItem, refetchOnWindowFocus: false },
  );
  const { data: transactions } = useQuery(listOpts);

  const addMutation = useMutation(
    trpc.inventory.transactions.add.mutationOptions(),
  );
  const deleteMutation = useMutation(
    trpc.inventory.transactions.delete.mutationOptions(),
  );

  const invalidateTransactions = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: listOpts.queryKey,
      }),
    [queryClient, listOpts.queryKey],
  );

  const addTransaction = async (formData: FormData) => {
    const itemId = formData.get("itemId") as string;
    const type = formData.get("type") as "IN" | "OUT";
    const price = Number(formData.get("price"));
    const quantity = Number(formData.get("quantity"));
    const quantityTypeValue = formData.get("quantityTypeValue") as string;

    await addMutation.mutateAsync({
      itemId,
      type,
      price,
      quantity,
      quantityTypeValue,
    });
    await invalidateTransactions();
  };

  const deleteTransaction = async (formData: FormData) => {
    const id = Number(formData.get("id"));
    await deleteMutation.mutateAsync({ id });
    await invalidateTransactions();
  };

  return {
    transactions: (transactions || []) as Transaction[],
    addTransaction,
    deleteTransaction,
  };
};
