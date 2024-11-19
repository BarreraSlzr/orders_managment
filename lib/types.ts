import { Selectable } from "kysely";
import { Database } from "./sql/types";

export type Order = Selectable<Database["orders"]>;
export type Product = Selectable<Database["products"]>;
export type OrderItemTable = Selectable<Database['order_items']>

export interface OrderItem extends OrderItemTable {
    productName: string
    productPrice: number
}