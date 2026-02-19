import { ColumnType, Generated, Selectable } from 'kysely'

interface BaseTable {
  id: Generated<string>
  // You can specify a different type for each operation (select, insert and
  // update) using the `ColumnType<SelectType, InsertType, UpdateType>`
  // wrapper. Here we define a column `createdAt` that is selected as
  // a `Date`, can optionally be provided as a `string` in inserts and
  // can never be updated:
  created: ColumnType<Date, string | undefined, never>
  deleted: ColumnType<Date | null, string | null | undefined, Date | null>
  updated: ColumnType<Date, string | undefined, never>
}

interface TenantTable {
  id: Generated<string>;
  name: string;
  created: ColumnType<Date, string | undefined, never>;
  updated: ColumnType<Date, string | undefined, never>;
}

interface UserTable {
  id: Generated<string>;
  tenant_id: string;
  username: string;
  role: "admin" | "manager" | "staff";
  password_hash: string;
  password_salt: string;
  permissions: ColumnType<string[] | null, string[] | undefined, string[] | null | undefined>;
  created: ColumnType<Date, string | undefined, never>;
  updated: ColumnType<Date, string | undefined, never>;
}

interface OrderTable extends BaseTable {
  closed: ColumnType<undefined, undefined, Date>
  position: number
  total: ColumnType<number, never, never>
}


interface ProductTable extends BaseTable {
  tenant_id: ColumnType<string | null, string | undefined, never>;
  name: string
  price: number
  tags: string
}

interface OrderTable extends BaseTable {
  tenant_id: ColumnType<string | null, string | undefined, never>;
  closed: ColumnType<undefined, undefined, Date>
  position: number
  total: ColumnType<number, never, never>
}

interface OrderItemTable {
  id: Generated<number>
  created: ColumnType<Date, string | undefined, never>
  tenant_id: ColumnType<string | null, string | undefined, never>
  order_id: string
  product_id: string
  is_takeaway: ColumnType<boolean, boolean | undefined, boolean | undefined>
  payment_option_id: ColumnType<number, number, number | undefined>
}

interface PaymentOptionsTable {
  id: Generated<number>
  created: ColumnType<Date, string | undefined, never>
  tenant_id: ColumnType<string | null, string | undefined, never>
  name: string
}

interface ExtrasTable {
  id: Generated<string>
  created: ColumnType<Date, string | undefined, never>
  deleted: ColumnType<Date | null, string | null | undefined, Date | null>
  updated: ColumnType<Date, string | undefined, Date>
  tenant_id: ColumnType<string | null, string | undefined, never>;
  name: string
  price: number
}

interface OrderItemExtrasTable {
  id: Generated<number>
  order_item_id: number
  extra_id: string
  created: ColumnType<Date, string | undefined, never>
  tenant_id: ColumnType<string | null, string | undefined, never>;
}

export type Extra = Selectable<ExtrasTable>;

export interface OrderItemExtra {
  id: number;
  extra_id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  items: (Pick<Selectable<OrderItemTable>, 'id'|'is_takeaway'|'payment_option_id'> & { extras: OrderItemExtra[] })[];
}

export interface OrderItemsView extends Selectable<OrderTable> {
  products: OrderItem[];
}

export interface InventoryItemsTable extends BaseTable {
  tenant_id: ColumnType<string | null, string | undefined, never>;
  name: string;
  status: 'pending' | 'completed';
  quantity_type_key: string;
}

export interface TransactionsTable {
  id: Generated<number>;
  item_id: string;
  type: 'IN' | 'OUT';
  created: ColumnType<Date, string | undefined, never>;
  tenant_id: ColumnType<string | null, string | undefined, never>;
  price: number;
  quantity: number;
  quantity_type_value: string;
}

export interface CategoriesTable extends BaseTable {
  tenant_id: ColumnType<string | null, string | undefined, never>;
  name: string;
}

interface CategoryInventoryItemTable {
  category_id: string;
  item_id: string;
  tenant_id: ColumnType<string | null, string | undefined, never>;
}

interface ProductConsumptionsTable extends BaseTable {
  product_id: string;
  item_id: string;
  is_takeaway: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  quantity: number;
}

interface SuppliersTable extends BaseTable {
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
}

interface SuppliersItemTable {
  supplier_item_id: string;
  item_id: string;
  supplier_id: string;
}

interface DomainEventsTable {
  id: Generated<number>;
  event_type: string;
  payload: ColumnType<string, string, string>;
  status: ColumnType<"pending" | "processed" | "failed", "pending" | "processed" | "failed", "pending" | "processed" | "failed">;
  result: ColumnType<string | null, string | null | undefined, string | null | undefined>;
  error_message: string | null;
  created: ColumnType<Date, string | undefined, never>;
  tenant_id: ColumnType<string | null, string | undefined, never>;
}

interface AdminAuditLogsTable {
  id: Generated<number>;
  admin_id: string;
  role: string | null;
  action: string;
  tenant_id: ColumnType<string | null, string | undefined, never>;
  target_tenant_id: ColumnType<string | null, string | undefined, never>;
  metadata: ColumnType<Record<string, unknown> | null, Record<string, unknown> | null | undefined, Record<string, unknown> | null | undefined>;
  created: ColumnType<Date, string | undefined, never>;
}

export interface MercadopagoCredentialsTable extends BaseTable {
  tenant_id: string;
  access_token: string; // encrypted in production
  app_id: string;
  user_id: string; // MP user ID from onboarding
  contact_email: ColumnType<string | null, string | null | undefined, string | null | undefined>;
  status: 'active' | 'inactive' | 'error';
  error_message: ColumnType<string | null, string | null | undefined, string | null | undefined>;
}

export interface MercadopagoAccessRequestsTable {
  id: Generated<string>;
  tenant_id: string;
  contact_email: string;
  status: 'pending' | 'completed' | 'canceled';
  requested_at: ColumnType<Date, string | undefined, string | undefined>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
  completed_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
}

export interface PaymentSyncAttemptsTable {
  id: Generated<number>;
  tenant_id: string;
  order_id: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'canceled' | 'error';
  terminal_id: ColumnType<string | null, string | null | undefined, string | null | undefined>;
  qr_code: ColumnType<string | null, string | null | undefined, string | null | undefined>;
  mp_transaction_id: ColumnType<string | null, string | null | undefined, string | null | undefined>;
  amount_cents: number;
  response_data: ColumnType<Record<string, unknown> | null, Record<string, unknown> | null | undefined, Record<string, unknown> | null | undefined>;
  error_data: ColumnType<Record<string, unknown> | null, Record<string, unknown> | null | undefined, Record<string, unknown> | null | undefined>;
  created: ColumnType<Date, string | undefined, never>;
  updated: ColumnType<Date, string | undefined, never>;
}

// Keys of this interface are table names.
export interface Database {
  tenants: TenantTable;
  users: UserTable;
  products: ProductTable;
  orders: OrderTable;
  order_items: OrderItemTable;
  payment_options: PaymentOptionsTable;
  extras: ExtrasTable;
  order_item_extras: OrderItemExtrasTable;
  inventory_items: InventoryItemsTable;
  transactions: TransactionsTable;
  categories: CategoriesTable;
  category_inventory_item: CategoryInventoryItemTable;
  domain_events: DomainEventsTable;
  admin_audit_logs: AdminAuditLogsTable;
  mercadopago_credentials: MercadopagoCredentialsTable;
  mercadopago_access_requests: MercadopagoAccessRequestsTable;
  payment_sync_attempts: PaymentSyncAttemptsTable;
  // product_consumptions: ProductConsumptionsTable;
  // suppliers: SuppliersTable;
  // suppliers_item: SuppliersItemTable;
}