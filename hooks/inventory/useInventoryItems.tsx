import { InventoryItemsTable } from "@/lib/sql/types";
import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Selectable } from "kysely";
import { useCallback, useState } from "react";
import { Category } from "./useCategories";

export type Item = Selectable<InventoryItemsTable> & {
  hasCategory: boolean;
};

export const useItems = (selectedCategory?: Pick<Category, "id"> | null) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listOpts = trpc.inventory.items.list.queryOptions(
    { categoryId: selectedCategory?.id },
    { refetchOnWindowFocus: true },
  );
  const { data: items } = useQuery(listOpts);

  const addMutation = useMutation(trpc.inventory.items.add.mutationOptions());
  const toggleMutation = useMutation(
    trpc.inventory.items.toggle.mutationOptions(),
  );
  const deleteMutation = useMutation(
    trpc.inventory.items.delete.mutationOptions(),
  );

  const [selectedItem, setSelectedItemState] = useState<Item | null>(null);

  const invalidateItems = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: listOpts.queryKey,
      }),
    [queryClient, listOpts.queryKey],
  );

  const addItem = async (formData: FormData) => {
    const name = formData.get("name") as string;
    const quantityTypeKey = formData.get("quantityTypeKey") as string;
    const categoryId =
      selectedCategory?.id ||
      (formData.get("categoryId") as string) ||
      undefined;

    await addMutation.mutateAsync({ name, quantityTypeKey, categoryId });
    await invalidateItems();
  };

  const deleteItem = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    await invalidateItems();
    if (selectedItem && selectedItem.id === id) {
      setSelectedItemState(null);
    }
  };

  const toggleItem = async (item: Item) => {
    await toggleMutation.mutateAsync({ id: item.id });
    await invalidateItems();
    if (item && item.status === "pending") {
      setSelectedItemState({ ...item, status: "completed" });
    }
  };

  return {
    items: (items || []) as Item[],
    selectedItem,
    setSelectedItem: setSelectedItemState,
    addItem,
    deleteItem,
    toggleItem,
  };
};
