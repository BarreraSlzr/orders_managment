import { Generated, ColumnType } from 'kysely'

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

interface ProductTable extends BaseTable{
  name: string
  price: number
  tags: string[]
}

interface OrderTable extends BaseTable{
  closed: ColumnType<undefined, undefined, Date>
  position: number
  total: ColumnType<number, never, never>
}

interface OrderItemTable {
  id: Generated<number>
  order_id: string
  product_id: string
  quantity: number
}

// Keys of this interface are table names.
export interface Database {
  products: ProductTable
  orders: OrderTable
  order_items: OrderItemTable
}