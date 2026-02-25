"use client";

import { useTRPC } from "@/lib/trpc/react";
import { Product, ProductContextType } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Updateable } from "kysely";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";

const defaultProduct: Updateable<Product> = {
  id: "",
  name: "",
  price: 0,
  tags: "",
};

export function useProducts(): ProductContextType {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listOpts = trpc.products.list.queryOptions(undefined, {
    refetchOnWindowFocus: false,
  });
  const { data: productsData } = useQuery(listOpts);

  const upsertMutation = useMutation(trpc.products.upsert.mutationOptions());
  const deleteMutation = useMutation(trpc.products.delete.mutationOptions());

  // Use shared 'selected' param for both products and orders
  // System determines type by checking which Map contains the ID
  const [selectedIds, setSelectedIds] = useQueryState(
    "selected",
    parseAsArrayOf(parseAsString).withDefault([]),
  );

  const productsMap = useMemo(() => {
    return new Map<string, Product>(
      productsData?.map((p: Product) => [p.id, p]) ?? [],
    );
  }, [productsData]);

  // Derive currentProduct from URL param
  // Single selection: if ID exists in products map, it's a product
  const currentProduct = useMemo(() => {
    if (selectedIds.length !== 1) return undefined;
    const selectedId = selectedIds[0];
    
    if (selectedId === "new") return { ...defaultProduct };
    
    // Check if this ID is a product (vs an order)
    const product = productsMap.get(selectedId);
    return product ? { ...defaultProduct, ...product } : undefined;
  }, [selectedIds, productsMap]);

  const invalidateProducts = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: listOpts.queryKey,
      }),
    [queryClient, listOpts.queryKey],
  );

  const handleEditProduct = (
    product?: Updateable<Product> | Product | null,
  ) => {
    if (typeof product === "undefined") {
      // Close the form by clearing selection
      setSelectedIds([]);
    } else if (product === null) {
      // Open create form with "new" marker
      setSelectedIds(["new"]);
    } else {
      // Open edit form with product ID (single selection)
      setSelectedIds([product.id || "new"]);
    }
  };

  const handleUpsertProduct = async (formData: FormData) => {
    const name = formData.get("name") as string;
    const price = Number(formData.get("price"));
    const tags = (formData.get("tags") as string) ?? "";
    const id = (formData.get("id") as string) || undefined;

    try {
      await upsertMutation.mutateAsync({
        id,
        name,
        price,
        tags,
      });
      await invalidateProducts();
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteProduct = async (formData: FormData) => {
    const id = formData.get("id") as string;
    try {
      await deleteMutation.mutateAsync({ id });
      await invalidateProducts();

      // Close form if we just deleted the current product
      if (currentProduct?.id === id) {
        setSelectedIds([]);
      }
    } catch (error) {
      throw error;
    }
  };

  return {
    products: productsMap,
    currentProduct,
    handleEditProduct,
    handleUpsertProduct,
    handleDeleteProduct,
  };
}
