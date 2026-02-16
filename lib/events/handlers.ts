import {
    deleteCategory,
    toggleCategoryItem,
    upsertCategory,
} from "@/lib/sql/functions/categories";
import { closeOrder } from "@/lib/sql/functions/closeOrder";
import {
    deleteExtra,
    toggleOrderItemExtra,
    upsertExtra,
} from "@/lib/sql/functions/extras";
import { insertOrder } from "@/lib/sql/functions/insertOrder";
import {
    addItem,
    deleteItem,
    toggleItem,
} from "@/lib/sql/functions/inventory";
import { splitOrder } from "@/lib/sql/functions/splitOrder";
import {
    addTransaction,
    deleteTransaction,
} from "@/lib/sql/functions/transactions";
import { updateOrderItem } from "@/lib/sql/functions/updateOrderItem";
import {
    removeProducts,
    togglePaymentOption,
    toggleTakeAway,
} from "@/lib/sql/functions/updateTakeAway";
import { upsertProduct } from "@/lib/sql/functions/upsertProduct";
import {
    DomainEventPayloadMap,
    DomainEventResultMap,
    DomainEventType,
} from "./contracts";

interface EventHandlerParams<TType extends DomainEventType> {
  payload: DomainEventPayloadMap[TType];
}

type DomainEventHandler<TType extends DomainEventType> = (
  params: EventHandlerParams<TType>
) => Promise<DomainEventResultMap[TType]>;

export const domainEventHandlers: {
  [TType in DomainEventType]: DomainEventHandler<TType>;
} = {
  "order.created": async ({ payload }) => {
    return insertOrder(payload.timeZone);
  },
  "order.item.updated": async ({ payload }) => {
    return updateOrderItem(payload.orderId, payload.productId, payload.type);
  },
  "order.split": async ({ payload }) => {
    return splitOrder({
      old_order_id: payload.oldOrderId,
      item_ids: payload.itemIds,
    });
  },
  "order.closed": async ({ payload }) => {
    return closeOrder(payload.orderId);
  },
  "order.payment.toggled": async ({ payload }) => {
    return togglePaymentOption(payload.itemIds);
  },
  "order.takeaway.toggled": async ({ payload }) => {
    return toggleTakeAway(payload.itemIds);
  },
  "order.products.removed": async ({ payload }) => {
    return removeProducts(payload.orderId, payload.itemIds);
  },
  "product.upserted": async ({ payload }) => {
    return upsertProduct({
      id: payload.id,
      name: payload.name,
      price: payload.price,
      tags: payload.tags,
    });
  },
  "inventory.item.added": async ({ payload }) => {
    const newItem = await addItem(payload.name, payload.quantityTypeKey);

    if (newItem && payload.categoryId) {
      const categoryStatus = await toggleCategoryItem(payload.categoryId, newItem.id);
      return {
        id: newItem.id,
        categoryStatus,
      };
    }

    return {
      id: newItem.id,
    };
  },
  "inventory.item.toggled": async ({ payload }) => {
    return toggleItem(payload.id);
  },
  "inventory.item.deleted": async ({ payload }) => {
    return deleteItem(payload.id);
  },
  "inventory.transaction.added": async ({ payload }) => {
    return addTransaction(
      payload.itemId,
      payload.type,
      payload.price,
      payload.quantity,
      payload.quantityTypeValue
    );
  },
  "inventory.transaction.deleted": async ({ payload }) => {
    return deleteTransaction(payload.id);
  },
  "inventory.category.upserted": async ({ payload }) => {
    return upsertCategory(payload.name, payload.id);
  },
  "inventory.category.deleted": async ({ payload }) => {
    return deleteCategory(payload.id);
  },
  "inventory.category.item.toggled": async ({ payload }) => {
    return toggleCategoryItem(payload.categoryId, payload.itemId);
  },
  "extra.upserted": async ({ payload }) => {
    return upsertExtra({
      id: payload.id,
      name: payload.name,
      price: payload.price,
    });
  },
  "extra.deleted": async ({ payload }) => {
    return deleteExtra(payload.id);
  },
  "order.item.extra.toggled": async ({ payload }) => {
    return toggleOrderItemExtra({
      orderItemId: payload.orderItemId,
      extraId: payload.extraId,
    });
  },
};
