// components/ReceiptItems.tsx

import { ExtrasToggle } from "@/components/Extras/ExtrasToggle";
import { Checkbox } from "@/components/ui/checkbox";
import { OrderItemsView } from "@/lib/sql/types";
import { formatPrice } from "@/lib/utils/formatPrice";
import { Fragment } from "react";

interface ReceiptItemsProps {
  items: OrderItemsView["products"];
  listProducts: boolean;
}

function itemExtrasTotal(extras: { price: number }[]): number {
  return extras.reduce((sum, e) => sum + e.price, 0);
}

export function ReceiptItems({ items, listProducts }: ReceiptItemsProps) {
  const itemsArray = Array.from(items.values());

  return (
    <div className="flex flex-col gap-4">
      {itemsArray.map((item) => (
        <Fragment key={item.product_id}>
          {Array.from(
            listProducts
              ? item.items
              : [
                  {
                    id: 0,
                    is_takeaway: false,
                    payment_option_id: 1,
                    extras: [] as {
                      id: number;
                      extra_id: string;
                      name: string;
                      price: number;
                    }[],
                  },
                ],
          ).map(({ id, is_takeaway, payment_option_id, extras }) => {
            const extrasPrice = itemExtrasTotal(extras);
            const unitPrice = item.price + extrasPrice;
            return (
              <div key={id} className="flex justify-between">
                <div className="items-top flex space-x-2">
                  {listProducts && (
                    <Checkbox id={`item_${id}`} name="item_id" value={id} />
                  )}
                  <div className="grid gap-1.5 leading-none">
                    <div className="flex gap-2">
                      <label
                        htmlFor={`item_${id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {item.name}
                      </label>
                      {listProducts && (
                        <>
                          <span title="Take Away">
                            {is_takeaway ? "🛍️" : ""}
                          </span>
                          <span title="Payment">
                            {payment_option_id === 1 ? "💵" : "💳"}
                          </span>
                        </>
                      )}
                    </div>
                    {listProducts && extras.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {extras.map((e) => (
                          <span
                            key={e.id}
                            className="text-xs text-amber-600 bg-amber-50 rounded px-1"
                          >
                            +{e.name} ({formatPrice(e.price)})
                          </span>
                        ))}
                      </div>
                    )}
                    {listProducts && (
                      <ExtrasToggle orderItemId={id} currentExtras={extras} />
                    )}
                    <div className="flex gap-1">
                      {!listProducts && (
                        <p className="text-xs text-muted-foreground">
                          Cant: {item.items.length}
                        </p>
                      )}
                      {!listProducts && (
                        <>
                          <span title="Take Away">
                            {item.items.some((it) => it.is_takeaway)
                              ? "🛍️"
                              : ""}
                          </span>
                          <span title="Payment">
                            {item.items.some((it) => it.payment_option_id === 1)
                              ? "💵"
                              : ""}
                            {item.items.some((it) => it.payment_option_id === 2)
                              ? "💳"
                              : ""}
                          </span>
                        </>
                      )}
                      {!listProducts &&
                        item.items.some((it) => it.extras.length > 0) && (
                          <span
                            className="text-xs text-amber-600"
                            title="Extras"
                          >
                            ⭐
                          </span>
                        )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(item.price)}
                  </p>
                  {listProducts && extrasPrice > 0 && (
                    <p className="text-xs text-amber-600">
                      +{formatPrice(extrasPrice)}
                    </p>
                  )}
                  {!listProducts && (
                    <p className="tabular-nums mt-auto">
                      {formatPrice(
                        item.items.reduce(
                          (sum, it) =>
                            sum + item.price + itemExtrasTotal(it.extras),
                          0,
                        ),
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
