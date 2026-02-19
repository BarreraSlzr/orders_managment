"use client";
import { PropsWithChildren } from "react";
import { useProducts } from "@/context/useProducts";
import { formatPrice } from "@/lib/utils/formatPrice";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Product } from "@/lib/types";
import { useProductsFilter } from "@/context/useProductsFilter";
import { Badge } from "../ui/badge";
import { useOnLongPress } from "@/hooks/useOnLongPress";

interface Props {
  product: Product;
}

export function ProductCard({
  product,
  children: actions,
}: PropsWithChildren<Props>) {
  const { handleEditProduct } = useProducts();
  const { selectedTags } = useProductsFilter();
  const { endPress, movePress, startPress } = useOnLongPress();

  return (
    <Card className="min-w-60 flex-grow cursor-pointer touch-auto hover:shadow-md transition-shadow">
      <CardContent
        className="p-4 select-none flex flex-row flex-wrap gap-2"
        onMouseDown={startPress(() => {
          handleEditProduct(product);
        })}
        onMouseUp={endPress}
        onMouseLeave={endPress}
        onMouseMove={movePress}
        onTouchStart={startPress(() => {
          handleEditProduct(product);
        })}
        onTouchEnd={endPress}
        onTouchMove={movePress}
      >
        <p className="font-semibold">{product.name}</p>
        {product.tags.split(",").map((tag) => (
          <Badge
            key={tag}
            variant={selectedTags.has(tag) ? "default" : "secondary"}
            className="opacity-30"
          >
            {tag}
          </Badge>
        ))}
      </CardContent>
      <CardFooter className="px-4 py-2 bg-gray-100 flex justify-between select-none">
        <p className="text-sm text-bold font-mono">
          {formatPrice(product.price)}
        </p>
        <div className="">{actions}</div>
      </CardFooter>
    </Card>
  );
}
