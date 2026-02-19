// components/ReceiptItems.tsx

import { ExtrasToggle } from "@/components/Extras/ExtrasToggle";
import { Checkbox } from "@/components/ui/checkbox";
import { useReceiptEdit } from "@/context/useReceiptEdit";
import { useOnLongPress } from "@/hooks/useOnLongPress";
import { OrderItem, OrderItemsView } from "@/lib/sql/types";
import { formatPrice } from "@/lib/utils/formatPrice";
import { Fragment } from "react";

interface ReceiptItemsProps {
  items: OrderItemsView["products"];
  listProducts: boolean;
}

function itemExtrasTotal(extras: { price: number }[]): number {
  return extras.reduce((sum, e) => sum + e.price, 0);
}

interface FlatRow {
  productId: string;
  name: string;
  price: number;
  id: number;
  is_takeaway: boolean;
  payment_option_id: number;
  extras: OrderItem["items"][number]["extras"];
}

function getPaymentIcon(paymentOptionId: number): string {
  // If no payment option set (0 or falsy), return empty
  if (!paymentOptionId || paymentOptionId === 0) return "";

  switch (paymentOptionId) {
    case 1:
      return "💵"; // Cash
    case 2:
      return "💳💸"; // Transfer
    case 3:
      return "💳"; // Credit Card
    case 4:
      return "💳"; // Debit Card
    case 5:
      return "💳📱"; // Mobile Payment
    case 6:
      return "💳🟠"; // Cryptocurrency
    default:
      return "💳"; // Fallback for unknown ids
  }
}

/**
 * View-mode aggregated icon string for a product row.
 * Shows 💵 if any item is cash, 💳 at most once if any non-cash exist,
 * plus distinguishing extras (💸 transfer, 📱 mobile, 🟠 crypto).
 */
function getAggregatedPaymentIcons(productItems: OrderItem["items"]): string {
  const ids = new Set(productItems.map((it) => it.payment_option_id));
  const parts: string[] = [];

  if (ids.has(1)) parts.push("💵");

  const hasNonCash = Array.from(ids).some((id) => id >= 2);
  if (hasNonCash) parts.push("💳");

  // Distinguishing extras (credit/debit already covered by 💳)
  if (ids.has(2)) parts.push("💸");
  if (ids.has(5)) parts.push("📱");
  if (ids.has(6)) parts.push("🟠");

  return parts.join("");
}

function flattenItems(items: OrderItem[]): FlatRow[] {
  return items.flatMap((p) =>
    p.items.map((it) => ({
      productId: p.product_id,
      name: p.name,
      price: p.price,
      id: it.id,
      is_takeaway: it.is_takeaway,
      payment_option_id: it.payment_option_id,
      extras: it.extras,
    })),
  );
}

function FlatItemRow({ row }: { row: FlatRow }) {
  const { selectedItemIds, toggleItemSelection } = useReceiptEdit();
  const isChecked = selectedItemIds.has(`${row.id}`);
  const extrasPrice = itemExtrasTotal(row.extras);
  return (
    <div className="flex justify-between flex-grow">
      <div className="items-top flex space-x-2 flex-grow relative">
        <Checkbox
          id={`item_${row.id}`}
          checked={isChecked}
          onCheckedChange={() => toggleItemSelection(`${row.id}`)}
        />
        <div className="grid gap-1.5 leading-none flex-grow">
          <div className="contents flex flex-grow flex-row gap-2 relative">
            <label
              htmlFor={`item_${row.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {row.name}
            </label>
            <div className="flex flex-row gap-2 absolute bottom-0 right-0 backdrop-blur-sm p-1 px-2 rounded-full">
              <span title="Take Away">{row.is_takeaway ? "🛍️" : ""}</span>
              <span title="Payment">
                {getPaymentIcon(row.payment_option_id)}
              </span>
            </div>
          </div>
          {row.extras.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.extras.map((e) => (
                <span
                  key={e.id}
                  className="text-xs text-amber-600 bg-amber-50 rounded px-1"
                >
                  +{e.name} ({formatPrice(e.price)})
                </span>
              ))}
            </div>
          )}
          <ExtrasToggle orderItemId={row.id} currentExtras={row.extras} />
        </div>
      </div>
      <div className="flex flex-col items-end">
        <p className="text-xs text-muted-foreground">
          {formatPrice(row.price)}
        </p>
        {extrasPrice > 0 && (
          <p className="text-xs text-amber-600">+{formatPrice(extrasPrice)}</p>
        )}
      </div>
    </div>
  );
}

export function ReceiptItems({ items, listProducts }: ReceiptItemsProps) {
  const { selectedItemIds } = useReceiptEdit();
  const itemsArray = Array.from(items.values());

  // ── edit-mode: flat list sorted unselected → selected with separator ──────
  if (listProducts) {
    const flat = flattenItems(itemsArray);
    const unselected = flat.filter((r) => !selectedItemIds.has(`${r.id}`));
    const selected = flat.filter((r) => selectedItemIds.has(`${r.id}`));

    return (
      <div className="flex flex-col gap-4">
        {unselected.map((row) => (
          <FlatItemRow key={row.id} row={row} />
        ))}
        {selected.length > 0 && (
          <>
            <hr className="border-dashed border-gray-400 my-1" />
            {selected.map((row) => (
              <FlatItemRow key={row.id} row={row} />
            ))}
          </>
        )}
      </div>
    );
  }

  // ── view-mode: aggregated one-row-per-product ─────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {itemsArray.map((item) => (
        <AggregatedRow key={item.product_id} item={item} />
      ))}
    </div>
  );
}

/** View-mode product row with long-press → enter edit mode + pre-select all items */
function AggregatedRow({ item }: { item: OrderItem }) {
  const { enterEditWithProduct } = useReceiptEdit();
  const { startPress, endPress } = useOnLongPress();

  const handleLongPress = startPress(() => {
    enterEditWithProduct(item.product_id);
  });

  return (
    <Fragment key={item.product_id}>
      <div
        className="flex flex-row gap-4 justify-between select-none touch-none"
        onTouchStart={(e) => {
          e.preventDefault();
          handleLongPress();
        }}
        onMouseDown={handleLongPress}
        onTouchEnd={endPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
      >
        <div className="flex flex-grow gap-2 relative">
          <label className="flex-grow text-sm font-medium leading-none">
            {item.name}
          </label>
          <div className="flex flex-row gap-2 absolute bottom-0 right-0">
            <span title="Take Away">
              {item.items.some((it) => it.is_takeaway) ? "🛍️" : ""}
            </span>
            <span title="Payment">{getAggregatedPaymentIcons(item.items)}</span>
          </div>
          {item.items.some((it) => it.extras.length > 0) && (
            <span className="text-xs text-amber-600" title="Extras">
              ⭐
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {item.items.length} x {formatPrice(item.price)}
          </p>
          <p className="tabular-nums mt-auto">
            {formatPrice(
              item.items.reduce(
                (sum, it) => sum + item.price + itemExtrasTotal(it.extras),
                0,
              ),
            )}
          </p>
        </div>
      </div>
    </Fragment>
  );
}
