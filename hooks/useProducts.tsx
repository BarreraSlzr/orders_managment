"use client";

import { useTRPC } from "@/lib/trpc/react";
import { Product, ProductContextType } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Updateable } from "kysely";
import { useCallback, useMemo, useState } from "react";

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

  const [currentProduct, setCurrentProduct] = useState<
    Updateable<Product> | Product | undefined
  >();

  const productsMap = useMemo(() => {
    return new Map<string, Product>(
      productsData?.map((p: Product) => [p.id, p]) ?? [],
    );
  }, [productsData]);

  const invalidateProducts = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: listOpts.queryKey,
      }),
    [queryClient, listOpts.queryKey],
  );

  const handleEditProduct = (product?: Product | null) => {
    if (typeof product === "undefined") {
      setCurrentProduct(() => undefined);
    } else if (product === null) {
      setCurrentProduct({ ...defaultProduct });
    } else {
      setCurrentProduct({ ...product });
    }
  };

  const handleUpsertProduct = async (formData: FormData) => {
    const name = formData.get("name") as string;
    const price = Number(formData.get("price"));
    const tags = (formData.get("tags") as string) ?? "";
    const id = (formData.get("id") as string) || undefined;

    const result = await upsertMutation.mutateAsync({ id, name, price, tags });
    await invalidateProducts();

    const updatedProduct = result as Product | undefined;
    if (updatedProduct && currentProduct?.id === updatedProduct.id) {
      setCurrentProduct({ ...updatedProduct });
    }
  };

  const handleDeleteProduct = async (formData: FormData) => {
    const id = formData.get("id") as string;
    await deleteMutation.mutateAsync({ id });
    await invalidateProducts();

    if (currentProduct?.id === id) {
      setCurrentProduct({ ...defaultProduct });
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
