import { Generated, ColumnType, Selectable } from 'kysely'

interface BaseTable {
  id: Generated<string>
  // You can specify a different type for each operation (select, insert and
  // update) using the `ColumnType<SelectType, InsertType, UpdateType>`
  // wrapper. Here we define a column `createdAt` that is selected as
  // a `Date`, can optionally be provided as a `string` in inserts and
  // can never be updated:
  created: ColumnType<Date, string | undefined, never>
  deleted: ColumnType<Date, string | undefined, never>
  updated: ColumnType<Date, string | undefined, never>
}

interface OrderTable extends BaseTable {
  closed: ColumnType<undefined, undefined, Date>
  position: number
  total: ColumnType<number, never, never>
}


interface ProductTable extends BaseTable {
  name: string
  price: number
  tags: string
}

interface OrderTable extends BaseTable {
  closed: ColumnType<undefined, undefined, Date>
  position: number
  total: ColumnType<number, never, never>
}

interface OrderItemTable {
  id: Generated<number>
  created: ColumnType<Date, string | undefined, never>
  order_id: string
  product_id: string
  is_takeaway: ColumnType<boolean, boolean | undefined, boolean | undefined>
  payment_option_id: ColumnType<number, number, number | undefined>
}

interface PaymentOptionsTable {
  id: Generated<number>
  created: ColumnType<Date, string | undefined, never>
  name: string
}

interface BaseTable {
  id: Generated<string>
  // You can specify a different type for each operation (select, insert and
  // update) using the `ColumnType<SelectType, InsertType, UpdateType>`
  // wrapper. Here we define a column `createdAt` that is selected as
  // a `Date`, can optionally be provided as a `string` in inserts and
  // can never be updated:
  created: ColumnType<Date, string | undefined, never>
  deleted: ColumnType<Date, string | undefined, never>
  updated: ColumnType<Date, string | undefined, never>
}

interface OrderTable extends BaseTable {
  closed: ColumnType<undefined, undefined, Date>
  position: number
  total: ColumnType<number, never, never>
}


export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  items: Pick<Selectable<OrderItemTable>, 'id'|'is_takeaway'|'payment_option_id'>[];
}

export interface OrderItemsView extends Selectable<OrderTable> {
  products: OrderItem[];
}

export interface Item extends BaseTable {
  name: string;
  status: 'pending' | 'completed';
}


// Keys of this interface are table names.
export interface Database {
  products: ProductTable;
  orders: OrderTable;
  order_items: OrderItemTable;
  order_items_view: OrderItemsView;
  payment_options: PaymentOptionsTable;
  items: Item;
}