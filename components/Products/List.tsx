import { useProducts } from "@/context/useProducts";
import { useProductsFilter } from "@/context/useProductsFilter";
import { Product } from "@/lib/types";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { ProductCard } from "./Card";
import { OrderControls } from "./OrderActions";

export interface IListProductsProps {
  products: Product[];
}

export function ListProducts({ products }: IListProductsProps) {
  const { handleEditProduct } = useProducts();
  const { selectedTags } = useProductsFilter();

  const sortedProducts = [...products].sort((left, right) => {
    const leftTags = new Set(
      left.tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    );
    const rightTags = new Set(
      right.tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    );
    const selected = Array.from(selectedTags).map((tag) =>
      tag.trim().toLowerCase(),
    );

    const leftMatchCount = selected.reduce(
      (count, tag) => count + (leftTags.has(tag) ? 1 : 0),
      0,
    );
    const rightMatchCount = selected.reduce(
      (count, tag) => count + (rightTags.has(tag) ? 1 : 0),
      0,
    );

    if (leftMatchCount !== rightMatchCount) {
      return rightMatchCount - leftMatchCount;
    }

    const leftName = left.name.toLocaleLowerCase("es-MX");
    const rightName = right.name.toLocaleLowerCase("es-MX");
    return leftName.localeCompare(rightName, "es-MX");
  });

  const createWithSelectedTags = () => {
    handleEditProduct({
      id: "",
      name: "",
      price: 0,
      tags: Array.from(selectedTags).join(","),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {sortedProducts.map((product) => (
          <ProductCard key={product.id} product={product}>
            <OrderControls product={product} />
          </ProductCard>
        ))}
      </div>
      <div className="flex justify-center">
        <Button type="button" onClick={createWithSelectedTags}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Producto
        </Button>
      </div>
    </div>
  );
}
