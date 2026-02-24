"use client";

import { ItemSelectorContent } from "@/components/Inventory/ItemSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProducts } from "@/context/useProducts";
import { useTRPC } from "@/lib/trpc/react";
import { Product } from "@/lib/types";
import { centsToMxDisplay, parseCurrencyToCents } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/formatDate";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

export const ProductForm = ({
  product,
}: {
  product: Product | Partial<Product>;
}) => {
  const {
    handleDeleteProduct,
    handleUpsertProduct,
    handleEditProduct,
  } = useProducts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [compositionOpen, setCompositionOpen] = useState(false);
  const trpc = useTRPC();
  const consumptionsQuery = useQuery({
    ...trpc.products.consumptions.list.queryOptions({
      productId: product.id ?? "",
    }),
    enabled: !!product.id,
  });
  const addConsumptionMutation = useMutation(
    trpc.products.consumptions.add.mutationOptions(),
  );
  const removeConsumptionMutation = useMutation(
    trpc.products.consumptions.remove.mutationOptions(),
  );
  const [priceInput, setPriceInput] = useState(() =>
    centsToMxDisplay(product.price ?? 0),
  );
  const [priceError, setPriceError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    setPriceInput(centsToMxDisplay(product.price ?? 0));
    setPriceError(null);
    setActionError(null);
  }, [product.id, product.price]);

  const parsedCents = parseCurrencyToCents(priceInput);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const submitType = submitter?.dataset.intent ?? "save";

    // Only validate price for save operations
    if (submitType === "save") {
      const cents = parseCurrencyToCents(priceInput);
      if (cents === null) {
        setPriceError("Precio inválido");
        return;
      }
      formData.set("price", `${cents}`);
    }

    formData.set("id", product.id ?? "");
    setIsSubmitting(true);
    setActionError(null);
    try {
      if (submitType === "save") {
        await handleUpsertProduct(formData);
        handleEditProduct();
      } else if (submitType === "delete") {
        await handleDeleteProduct(formData);
        handleEditProduct();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Operación fallida. Por favor intente de nuevo.";
      setActionError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const duplicateCurrentProduct = () => {
    handleEditProduct({
      id: "",
      name: product.name ?? "",
      price: typeof product.price === "number" ? product.price : 0,
      tags: product.tags ?? "",
    });
  };

  const closeForm = () => handleEditProduct();

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent clicks inside the card from propagating to backdrop
    e.stopPropagation();
  };

  return (
    <>
      <Card
        className="w-full max-w-md mx-auto cursor-pointer touch-auto hover:shadow-md transition-shadow"
        onClick={handleCardClick}
      >
        <CardHeader className="relative">
          <CardTitle className="text-2xl font-bold">
            {product.id ? "Editar" : "Crear"} Producto
          </CardTitle>
          {product.id && product.updated && (
            <>
              <pre className="font-mono text-xs">{product.id}</pre>
              <pre className="font-mono text-xs">
                {formatDate(new Date(product.updated))}
              </pre>
            </>
          )}
          <Button
            type="button"
            variant={"ghost"}
            className="absolute top-0 right-0"
            onClick={closeForm}
            disabled={isSubmitting}
            title="Cerrar"
          >
            <X />
          </Button>
        </CardHeader>
        <CardContent>
          <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                key={`${product.id ?? "new"}-name`}
                type="text"
                id="name"
                name="name"
                defaultValue={product.name ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Precio</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  key={`${product.id ?? "new"}-price`}
                  type="text"
                  inputMode="decimal"
                  id="price"
                  value={priceInput}
                  onChange={(event) => {
                    setPriceInput(event.target.value);
                    if (priceError) setPriceError(null);
                  }}
                  onBlur={() => {
                    const cents = parseCurrencyToCents(priceInput);
                    if (cents === null) {
                      setPriceError("Precio inválido");
                      return;
                    }
                    setPriceInput(centsToMxDisplay(cents));
                    setPriceError(null);
                  }}
                  className="pl-7 pr-12"
                  required
                  aria-invalid={Boolean(priceError)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                  MXN
                </span>
              </div>
              <input type="hidden" name="price" value={parsedCents ?? ""} />
              {priceError && (
                <p className="text-xs text-red-600">{priceError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (Separados por comas)</Label>
              <Input
                key={`${product.id ?? "new"}-tags`}
                type="text"
                id="tags"
                name="tags"
                defaultValue={product.tags ?? ""}
              />
            </div>
            {actionError && (
              <div className="rounded-md bg-red-50 p-3 border border-red-200">
                <p className="text-sm text-red-800">{actionError}</p>
              </div>
            )}
            <div className="flex justify-between pt-4">
              <Button
                type="submit"
                data-intent="save"
                disabled={isSubmitting}
                title="Guardar producto"
              >
                <Save className="h-4 w-4 mr-1" />
                Guardar
              </Button>
              <div className="flex gap-2">
                {product.id && (
                  <Button
                    type="submit"
                    data-intent="delete"
                    variant="destructive"
                    disabled={isSubmitting}
                    title="Eliminar producto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={duplicateCurrentProduct}
                  disabled={!product.id || isSubmitting}
                  title="Duplicar producto"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Duplicar
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Composition section — black panel, same pattern as OrderSheet bottom ── */}
      {product.id && (
        <div className="w-full max-w-md mx-auto bg-black rounded-xl border border-zinc-800 text-white flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-mono uppercase tracking-widest text-white">
              Composición
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              {consumptionsQuery.data?.length ?? 0} ingrediente
              {(consumptionsQuery.data?.length ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-3 p-4">
            {/* Current consumptions list */}
            {(consumptionsQuery.data ?? []).length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {consumptionsQuery.data!.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between text-sm rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          c.stock > 0 ? "bg-green-400" : "bg-red-500"
                        }`}
                      />
                      <span className="font-medium text-white">
                        {c.item_name}
                      </span>
                    </span>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className="text-xs text-zinc-400 font-mono">
                        {c.quantity} {c.quantity_type_value}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                        disabled={removeConsumptionMutation.isPending}
                        onClick={async () => {
                          await removeConsumptionMutation.mutateAsync({
                            id: c.id,
                          });
                          void consumptionsQuery.refetch();
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Inline ingredient selector — same stacking context, no portal */}
            {compositionOpen ? (
              <ItemSelectorContent
                title="Agregar ingrediente"
                onConfirm={async ({ itemId, quantity, unit }) => {
                  await addConsumptionMutation.mutateAsync({
                    productId: product.id!,
                    itemId,
                    quantity,
                    quantityTypeValue: unit,
                  });
                  void consumptionsQuery.refetch();
                  setCompositionOpen(false);
                }}
                onCancel={() => setCompositionOpen(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCompositionOpen(true)}
                className="group w-full flex items-center gap-3 px-1 py-1 hover:bg-zinc-900 transition-colors rounded-lg"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 group-hover:border-zinc-500 transition-colors">
                  <Plus className="h-3.5 w-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                </span>
                <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  Agregar ingrediente
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
