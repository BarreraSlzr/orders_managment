import { Selectable } from "kysely";
import { Database } from "./sql/types";

export type Order = Selectable<Database["orders"]>;
export type Product = Selectable<Database["products"]>;
export type OrderItemTable = Selectable<Database['order_items']>

export interface OrderItem extends Pick<OrderItemTable, "product_id"> {
    productName: string
    productPrice: number
    quantity: number
}

export interface OrderItems {
    order: Order,
    items: OrderItem[]
}