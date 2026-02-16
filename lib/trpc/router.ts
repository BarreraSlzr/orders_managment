import { router } from "./init";
import { adminRouter } from "./routers/admin";
import { extrasRouter } from "./routers/extras";
import { inventoryRouter } from "./routers/inventory";
import { ordersRouter } from "./routers/orders";
import { productsRouter } from "./routers/products";
import { usersRouter } from "./routers/users";

export const appRouter = router({
  orders: ordersRouter,
  products: productsRouter,
  inventory: inventoryRouter,
  extras: extrasRouter,
  admin: adminRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
