import { router } from "./init";
import { extrasRouter } from "./routers/extras";
import { inventoryRouter } from "./routers/inventory";
import { ordersRouter } from "./routers/orders";
import { productsRouter } from "./routers/products";

export const appRouter = router({
  orders: ordersRouter,
  products: productsRouter,
  inventory: inventoryRouter,
  extras: extrasRouter,
});

export type AppRouter = typeof appRouter;
