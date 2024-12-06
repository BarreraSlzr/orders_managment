// components/ReceiptItems.tsx

import { Fragment } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/lib/utils/formatPrice";
import { OrderItemsFE } from "@/lib/types";

interface ReceiptItemsProps {
    items: OrderItemsFE['items'];
    listProducts: boolean;
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
                            : [{ id: 0, is_takeaway: false, payment_option_id: 1 }]
                    ).map(({ id, is_takeaway, payment_option_id }) => (
                        <div key={id} className="flex justify-between">
                            <div className="items-top flex space-x-2">
                                {listProducts && <Checkbox id={`item_${id}`} name="item_id" value={id} />}
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
                                                <span title="Take Away">{is_takeaway ? '🛍️' : ''}</span>
                                                <span title="Payment">{payment_option_id === 1 ? '💵' : '💳'}</span>
                                            </>)}
                                    </div>
                                    <div className="flex gap-1">
                                        {!listProducts && (
                                            <p className="text-xs text-muted-foreground">Cant: {item.items.length}</p>
                                        )}
                                        {!listProducts && (
                                            <>
                                                <span title="Take Away">
                                                    {item.items.some(it => it.is_takeaway) ? '🛍️' : ''}
                                                </span>
                                                <span title="Payment">
                                                    {item.items.some(it => it.payment_option_id === 1) ? '💵'  : ''}
                                                    {item.items.some(it => it.payment_option_id === 2) ? '💳'  : ''}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                                {!listProducts && (
                                    <p className="tabular-nums mt-auto">{formatPrice(item.price * item.items.length)}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </Fragment>
            ))}
        </div>
    );
}
