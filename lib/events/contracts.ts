import { CategoriesTable, Extra, OrderItemsView } from "@/lib/sql/types";
import { Order, OrderItemTable, Product } from "@/lib/types";
import { Selectable } from "kysely";

export type DomainEventType =
  | "order.created"
  | "order.item.updated"
  | "order.split"
  | "order.closed"
  | "order.payment.toggled"
  | "order.takeaway.toggled"
  | "order.products.removed"
  | "product.upserted"
  | "inventory.item.added"
  | "inventory.item.toggled"
  | "inventory.item.deleted"
  | "inventory.transaction.added"
  | "inventory.transaction.deleted"
  | "inventory.category.upserted"
  | "inventory.category.deleted"
  | "inventory.category.item.toggled"
  | "extra.upserted"
  | "extra.deleted"
  | "order.item.extra.toggled"
  | "admin.audit.logged";

export interface DomainEventPayloadMap {
  "order.created": {
    tenantId: string;
    timeZone: string;
  };
  "order.item.updated": {
    tenantId: string;
    orderId: string;
    productId: string;
    type: "INSERT" | "DELETE";
  };
  "order.split": {
    tenantId: string;
    oldOrderId: string;
    itemIds: OrderItemTable["id"][];
  };
  "order.closed": {
    tenantId: string;
    orderId: string;
  };
  "order.payment.toggled": {
    tenantId: string;
    itemIds: OrderItemTable["id"][];
  };
  "order.takeaway.toggled": {
    tenantId: string;
    itemIds: OrderItemTable["id"][];
  };
  "order.products.removed": {
    tenantId: string;
    orderId: string;
    itemIds: OrderItemTable["id"][];
  };
  "product.upserted": {
    tenantId: string;
    id?: string;
    name: string;
    price: number;
    tags: string;
  };
  "inventory.item.added": {
    tenantId: string;
    name: string;
    quantityTypeKey: string;
    categoryId?: string;
  };
  "inventory.item.toggled": {
    tenantId: string;
    id: string;
  };
  "inventory.item.deleted": {
    tenantId: string;
    id: string;
  };
  "inventory.transaction.added": {
    tenantId: string;
    itemId: string;
    type: "IN" | "OUT";
    price: number;
    quantity: number;
    quantityTypeValue: string;
  };
  "inventory.transaction.deleted": {
    tenantId: string;
    id: number;
  };
  "inventory.category.upserted": {
    tenantId: string;
    name: string;
    id?: string;
  };
  "inventory.category.deleted": {
    tenantId: string;
    id: string;
  };
  "inventory.category.item.toggled": {
    tenantId: string;
    categoryId: string;
    itemId: string;
  };
  "extra.upserted": {
    tenantId: string;
    id?: string;
    name: string;
    price: number;
  };
  "extra.deleted": {
    tenantId: string;
    id: string;
  };
  "order.item.extra.toggled": {
    tenantId: string;
    orderItemId: number;
    extraId: string;
  };
  "admin.audit.logged": {
    tenantId: string;
    adminId: string;
    role?: string;
    action: string;
    targetTenantId?: string;
    metadata?: Record<string, unknown> | null;
  };
}

export interface DomainEventResultMap {
  "order.created": Order;
  "order.item.updated": OrderItemTable | null;
  "order.split": {
    newOrder: OrderItemsView;
    oldOrder: Order;
  };
  "order.closed": Order;
  "order.payment.toggled": Array<
    Pick<OrderItemTable, "id" | "product_id" | "payment_option_id" | "is_takeaway">
  >;
  "order.takeaway.toggled": Array<
    Pick<OrderItemTable, "id" | "product_id" | "payment_option_id" | "is_takeaway">
  >;
  "order.products.removed": {
    numDeletedRows: bigint;
  }[];
  "product.upserted": Product;
  "inventory.item.added": {
    id: string;
    categoryStatus?: string;
  };
  "inventory.item.toggled": unknown;
  "inventory.item.deleted": unknown;
  "inventory.transaction.added": unknown;
  "inventory.transaction.deleted": unknown;
  "inventory.category.upserted": Selectable<CategoriesTable>;
  "inventory.category.deleted": {
    deleted: string[];
  };
  "inventory.category.item.toggled": string;
  "extra.upserted": Extra;
  "extra.deleted": Extra;
  "order.item.extra.toggled": {
    action: "added" | "removed";
    orderItemId: number;
    extraId: string;
  };
  "admin.audit.logged": {
    id: number;
  };
}

export interface DomainEvent<TType extends DomainEventType = DomainEventType> {
  type: TType;
  payload: DomainEventPayloadMap[TType];
}

export interface DispatchDomainEventParams<TType extends DomainEventType> {
  type: TType;
  payload: DomainEventPayloadMap[TType];
}
