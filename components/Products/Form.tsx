"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProducts } from "@/context/useProducts";
import { Product } from "@/lib/types";
import { formatDate } from "@/lib/utils/formatDate";
import { Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function parseCurrencyToCents(value: string): number | null {
  const raw = value.trim();
  if (!raw) return 0;

  const sanitized = raw.replace(/\s|\$/g, "");
  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");

  let normalized = sanitized;

  if (hasComma && hasDot) {
    if (sanitized.lastIndexOf(",") > sanitized.lastIndexOf(".")) {
      normalized = sanitized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = sanitized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = sanitized.replace(/\./g, "").replace(",", ".");
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function centsToMxDisplay(cents: number): string {
  return (cents / 100).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  const [priceInput, setPriceInput] = useState(() =>
    centsToMxDisplay(product.price ?? 0),
  );
  const [priceError, setPriceError] = useState<string | null>(null);
  const mxnFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  useEffect(() => {
    setPriceInput(centsToMxDisplay(product.price ?? 0));
    setPriceError(null);
  }, [product.id, product.price]);

  const parsedCents = parseCurrencyToCents(priceInput);
  const pricePreview = mxnFormatter.format((parsedCents ?? 0) / 100);

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
    try {
      if (submitType === "save") {
        await handleUpsertProduct(formData);
        handleEditProduct();
      } else if (submitType === "delete") {
        await handleDeleteProduct(formData);
        handleEditProduct();
      }
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
            {priceError ? (
              <p className="text-xs text-red-600">{priceError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{pricePreview}</p>
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
  );
};
