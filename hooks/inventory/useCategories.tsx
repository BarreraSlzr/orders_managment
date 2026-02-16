import { CategoriesTable } from "@/lib/sql/types";
import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Selectable } from "kysely";
import { useCallback, useState } from "react";

export type Category = Selectable<CategoriesTable>;

export const useCategories = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listOpts = trpc.inventory.categories.list.queryOptions(undefined, {
    refetchOnWindowFocus: false,
  });
  const { data: categories } = useQuery(listOpts);

  const upsertMutation = useMutation(
    trpc.inventory.categories.upsert.mutationOptions(),
  );
  const deleteMutation = useMutation(
    trpc.inventory.categories.delete.mutationOptions(),
  );
  const [
    selectedCategory,
    setSelectedCategoryState,
  ] = useState<Category | null>(null);

  const invalidateCategories = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: listOpts.queryKey,
      }),
    [queryClient, listOpts.queryKey],
  );

  const deleteCategory = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    await invalidateCategories();
    if (selectedCategory && selectedCategory.id === id) {
      setSelectedCategoryState(null);
    }
  };

  const updateCategory = async (formData: FormData) => {
    const name = formData.get("name") as string;
    const id =
      selectedCategory?.id || (formData.get("id") as string) || undefined;
    await upsertMutation.mutateAsync({ id, name });
    await invalidateCategories();
  };

  return {
    categories: (categories || []) as Category[],
    selectedCategory,
    setSelectedCategory: setSelectedCategoryState,
    deleteCategory,
    updateCategory,
  };
};
