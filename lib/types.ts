import { Selectable } from "kysely";
import { Database } from "./sql/types";

export type Order = Selectable<Database["orders"]>;
export type Product = Selectable<Database["products"]>;

export interface OrderItem {
    id: number
    product_id: string
    quantity: number
    productName: string
    price: number
}