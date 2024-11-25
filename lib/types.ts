import { Selectable } from "kysely";
import { Database } from "./sql/types";

export type Order = Selectable<Database["orders"]>;
export type Product = Selectable<Database["products"]>;
export type OrderItemTable = Selectable<Database['order_items']>

export interface OrderItem extends Pick<OrderItemTable, "product_id"> {
    name: string
    price: number
    quantity: number
}

export interface OrderItems {
    order: Order,
    items: OrderItem[]
}

export interface OrderItemsFE {
    order: Order,
    items: Map<OrderItem['product_id'], OrderItem>
}

export interface OrderContextState {
    isPending: boolean;
    products: Product[];
    tagsSorted: [string, number][];
    currentOrder: OrderItemsFE | null;
    orders: Map<Order['id'], Order>;
    searchQuery: string;
    selectedTags: Set<string>;
    visibleProducts: Product[];
    visibleTags: [string, number][];
  }
  
  export interface OrderContextActions {
    handleAddOrder: (productId?: string) => void;
    handleUpdateOrderItems: (productId: string, type: "INSERT" | "DELETE") => void;
    handleCloseOrder: () => void;
    setSearchQuery: (query: string) => void;
    setSelectedTags: (tags: Set<string>) => void;
    setCurrentOrderDetails: (order: Order | null) => void;
    resetFilters: () => void;
  }
  
  export type OrderContextType = OrderContextState & OrderContextActions;
  