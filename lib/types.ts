import { Selectable, Updateable } from "kysely";
import { Database } from "./sql/types";

export type Order = Selectable<Database["orders"]>;
export type Product = Selectable<Database["products"]>;
export type OrderItemTable = Selectable<Database['order_items']>

export interface OrderItem extends Pick<OrderItemTable, "product_id"> {
    name: string
    price: number
    items: Pick<OrderItemTable, 'id' | 'is_takeaway' | 'payment_option_id'>[]
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
    tagsSorted: [string, number][];
    currentOrder: OrderItemsFE | null;
    orders: Map<Order['id'], Order>;
    searchQuery: string;
    selectedTags: Set<string>;
    visibleProducts: Product[];
    visibleTags: [string, number][];
  }
  
  export interface OrderContextActions {
    handleUpdateItemDetails: (actionType: 'updatePayment' | 'toggleTakeAway',formData: FormData) => Promise<boolean>
    handleSplitOrder: (formData: FormData) => Promise<boolean>
    handleAddOrder: (productId?: string) => Promise<void>;
    handleUpdateOrderItems: (productId: string, type: "INSERT" | "DELETE") => Promise<void>;
    handleCloseOrder: () => Promise<void>;
    setSearchQuery: (query: string) => void;
    setSelectedTags: (tags: Set<string>) => void;
    setCurrentOrderDetails: (order: Order | null) => Promise<void>;
    resetFilters: () => void;
  }
  
  export type OrderContextType = OrderContextState & OrderContextActions;

  export interface ProductContextType {
    products: Map<Product['id'], Product>;
    currentProduct: Updateable<Product>;
    handleEditProduct: (product?: Updateable<Product>) => void;
    handleUpsertProduct: (formData: FormData) => Promise<void>;
    handleDeleteProduct: (formData: FormData) => Promise<void>;
  }
  
  