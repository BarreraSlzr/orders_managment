"use client";

import { Toggle } from "@/components/ui/toggle";
import { useOrderItemsProducts } from "@/context/useOrderItemsProducts";
import { useExtras } from "@/hooks/useExtras";
import { OrderItemExtra } from "@/lib/sql/types";
import { formatPrice } from "@/lib/utils/formatPrice";

interface ExtrasToggleProps {
  orderItemId: number;
  currentExtras: OrderItemExtra[];
}

const EXTRA_COLORS = [
  "bg-amber-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-teal-500",
];

export function ExtrasToggle({
  orderItemId,
  currentExtras,
}: ExtrasToggleProps) {
  const { extras } = useExtras();
  const { handleToggleExtra } = useOrderItemsProducts();

  if (extras.length === 0) return null;

  const activeExtraIds = new Set(currentExtras.map((e) => e.extra_id));

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {extras.map((extra, i) => (
        <Toggle
          key={extra.id}
          size="sm"
          className={`${
            EXTRA_COLORS[i % EXTRA_COLORS.length]
          } text-white text-xs h-5 px-1.5`}
          pressed={activeExtraIds.has(extra.id)}
          onPressedChange={() =>
            handleToggleExtra({ orderItemId, extraId: extra.id })
          }
        >
          {extra.name} +{formatPrice(extra.price)}
        </Toggle>
      ))}
    </div>
  );
}
