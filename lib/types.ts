import { Selectable, Updateable } from "kysely";
import { Database, OrderItemsView } from "./sql/types";

export type Order = Selectable<Database["orders"]>;
export type Product = Selectable<Database["products"]>;
export type OrderItemTable = Selectable<Database['order_items']>


export interface OrdersQuery {
  timeZone?: string;
  date?: string; // ISO date string: 'YYYY-MM-DD'
  isClosed?: boolean; // Include only closed orders if true, or only open orders if false
  all?: boolean,
  status?: 'closed' | 'opened' | string |undefined,
}

export interface OrderContextState {
  isPending: boolean;
  currentOrder: OrderItemsView | null;
  orders: Map<Order['id'], Order>;
}

export interface OrderContextActions {
  updateCurrentOrder: (value: OrderContextState['currentOrder']) => void;
  fetchOrders: (query: OrdersQuery ) => Promise<void>;
  handleUpdateItemDetails: (actionType: 'updatePayment' | 'toggleTakeAway' | 'remove', formData: FormData) => Promise<boolean>
  setCurrentOrderDetails: (order: Order | null) => Promise<void>;
  handleSplitOrder: (formData: FormData) => Promise<boolean>
  handleCloseOrder: (formData: FormData) => Promise<boolean>;
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
  handleToggleExtra: (params: { orderItemId: number; extraId: string }) => Promise<void>;
}

export type OrderItemsContext = OrderItemsContextActions;

export type OrderContextType = OrderContextState & Omit<OrderContextActions
, 'setCurrentOrder' | 'updateCurrentOrder'> & OrderItemsContext;

export interface ProductContextType {
  products: Map<Product['id'], Product>;
  currentProduct?: Updateable<Product> | Product;
  handleEditProduct: (product?: Product) => void;
  handleUpsertProduct: (formData: FormData) => Promise<void>;
  handleDeleteProduct: (formData: FormData) => Promise<void>;
}

