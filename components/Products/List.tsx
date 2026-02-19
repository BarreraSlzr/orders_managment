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
        {products.map((product) => (
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
