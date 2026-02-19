import {
    deleteCategory,
    toggleCategoryItem,
    upsertCategory,
} from "@/lib/sql/functions/categories";
import { closeOrder } from "@/lib/sql/functions/closeOrder";
import { openOrder } from "@/lib/sql/functions/openOrder";
import { combineOrders } from "@/lib/sql/functions/combineOrders";
import {
    deleteExtra,
    toggleOrderItemExtra,
    upsertExtra,
} from "@/lib/sql/functions/extras";
import { insertOrder } from "@/lib/sql/functions/insertOrder";
import { createAdminAuditLog } from "@/lib/sql/functions/adminAudit";
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
    setPaymentOption,
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
    return insertOrder({ tenantId: payload.tenantId, timeZone: payload.timeZone });
  },
  "order.item.updated": async ({ payload }) => {
    return updateOrderItem({
      tenantId: payload.tenantId,
      orderId: payload.orderId,
      productId: payload.productId,
      type: payload.type,
      // Apply admin defaults from client (lazily synced)
      defaultPaymentOptionId: payload.defaultPaymentOptionId,
      defaultIsTakeaway: payload.defaultIsTakeaway,
    });
  },
  "order.split": async ({ payload }) => {
    return splitOrder({
      tenantId: payload.tenantId,
      oldOrderId: payload.oldOrderId,
      itemIds: payload.itemIds,
    });
  },
  "order.combined": async ({ payload }) => {
    return combineOrders({
      tenantId: payload.tenantId,
      targetOrderId: payload.targetOrderId,
      sourceOrderIds: payload.sourceOrderIds,
    });
  },
  "order.closed": async ({ payload }) => {
    return closeOrder({ tenantId: payload.tenantId, orderId: payload.orderId });
  },
  "order.opened": async ({ payload }) => {
    return openOrder({ tenantId: payload.tenantId, orderId: payload.orderId });
  },
  "order.payment.toggled": async ({ payload }) => {
    return togglePaymentOption({
      tenantId: payload.tenantId,
      itemIds: payload.itemIds,
    });
  },
  "order.payment.set": async ({ payload }) => {
    return setPaymentOption({
      tenantId: payload.tenantId,
      itemIds: payload.itemIds,
      paymentOptionId: payload.paymentOptionId,
    });
  },
  "order.takeaway.toggled": async ({ payload }) => {
    return toggleTakeAway({ tenantId: payload.tenantId, itemIds: payload.itemIds });
  },
  "order.products.removed": async ({ payload }) => {
    return removeProducts({
      tenantId: payload.tenantId,
      orderId: payload.orderId,
      itemIds: payload.itemIds,
    });
  },
  "product.upserted": async ({ payload }) => {
    return upsertProduct({
      tenantId: payload.tenantId,
      id: payload.id,
      name: payload.name,
      price: payload.price,
      tags: payload.tags,
    });
  },
  "inventory.item.added": async ({ payload }) => {
    const newItem = await addItem({
      tenantId: payload.tenantId,
      name: payload.name,
      quantityTypeKey: payload.quantityTypeKey,
    });

    if (newItem && payload.categoryId) {
      const categoryStatus = await toggleCategoryItem({
        tenantId: payload.tenantId,
        categoryId: payload.categoryId,
        itemId: newItem.id,
      });
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
    return toggleItem({ tenantId: payload.tenantId, id: payload.id });
  },
  "inventory.item.deleted": async ({ payload }) => {
    return deleteItem({ tenantId: payload.tenantId, id: payload.id });
  },
  "inventory.transaction.added": async ({ payload }) => {
    return addTransaction(
      {
        tenantId: payload.tenantId,
        itemId: payload.itemId,
        type: payload.type,
        price: payload.price,
        quantity: payload.quantity,
        quantityTypeValue: payload.quantityTypeValue,
      }
    );
  },
  "inventory.transaction.deleted": async ({ payload }) => {
    return deleteTransaction({ tenantId: payload.tenantId, id: payload.id });
  },
  "inventory.category.upserted": async ({ payload }) => {
    return upsertCategory({
      tenantId: payload.tenantId,
      name: payload.name,
      id: payload.id,
    });
  },
  "inventory.category.deleted": async ({ payload }) => {
    return deleteCategory({ tenantId: payload.tenantId, id: payload.id });
  },
  "inventory.category.item.toggled": async ({ payload }) => {
    return toggleCategoryItem({
      tenantId: payload.tenantId,
      categoryId: payload.categoryId,
      itemId: payload.itemId,
    });
  },
  "extra.upserted": async ({ payload }) => {
    return upsertExtra({
      tenantId: payload.tenantId,
      id: payload.id,
      name: payload.name,
      price: payload.price,
    });
  },
  "extra.deleted": async ({ payload }) => {
    return deleteExtra({ tenantId: payload.tenantId, id: payload.id });
  },
  "order.item.extra.toggled": async ({ payload }) => {
    return toggleOrderItemExtra({
      tenantId: payload.tenantId,
      orderItemId: payload.orderItemId,
      extraId: payload.extraId,
    });
  },
  "admin.audit.logged": async ({ payload }) => {
    return createAdminAuditLog({
      action: payload.action,
      adminId: payload.adminId,
      role: payload.role,
      tenantId: payload.tenantId,
      targetTenantId: payload.targetTenantId,
      metadata: payload.metadata ?? null,
    });
  },
};
