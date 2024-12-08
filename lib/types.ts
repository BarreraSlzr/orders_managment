import { startTransition } from 'react';
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

export interface OrdersQuery {
  timeZone?: string;
  date?: string; // ISO date string: 'YYYY-MM-DD'
  isClosed?: boolean; // Include only closed orders if true, or only open orders if false
  all?: boolean
}

export interface OrderContextState {
  isPending: boolean;
  currentOrder: OrderItemsFE | null;
  orders: Map<Order['id'], Order>;
}

export interface OrderContextActions {
  startTransition: ( cb: () => Promise<void>) => void;
  setOrders: (v: OrderContextState['orders']) => void;
  setCurrentOrder: (v: OrderContextState['currentOrder']) => void;
  updateCurrentOrder: (value: OrderItems) => void;

  fetchOrders: (query: OrdersQuery ) => Promise<void>;
  handleUpdateItemDetails: (actionType: 'updatePayment' | 'toggleTakeAway' | 'remove', formData: FormData) => Promise<boolean>
  setCurrentOrderDetails: (order: Order | null) => Promise<void>;
  handleSplitOrder: (formData: FormData) => Promise<boolean>
  handleCloseOrder: () => Promise<void>;
}

export interface ProductFilterContextState {
  tagsSorted: [string, number][];
  searchQuery: string;
  selectedTags: Set<string>;
  visibleProducts: Product[];
  visibleTags: [string, number][];
}

export interface ProductFilterContextActions {
  setSearchQuery: (query: string) => void;
  setSelectedTags: (tags: Set<string>) => void;
  resetFilters: () => void;
  handleTagToggle: (tag: string) => void
}

export interface OrderItemsContextActions {
  handleAddOrder: (productId?: string) => Promise<void>;
  handleUpdateOrderItems: (productId: string, type: "INSERT" | "DELETE") => Promise<void>;
}

export type OrderItemsContext = OrderItemsContextActions;

export type OrderContextType = OrderContextState & Omit<OrderContextActions
, 'startTransition' | 'setOrders' | 'setCurrentOrder' | 'updateCurrentOrder'> & OrderItemsContext;

export interface ProductContextType {
  products: Map<Product['id'], Product>;
  currentProduct: Updateable<Product>;
  handleEditProduct: (product?: Updateable<Product>) => void;
  handleUpsertProduct: (formData: FormData) => Promise<void>;
  handleDeleteProduct: (formData: FormData) => Promise<void>;
}

