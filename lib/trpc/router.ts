import { router } from "./init";
import { inventoryRouter } from "./routers/inventory";
import { ordersRouter } from "./routers/orders";
import { productsRouter } from "./routers/products";

export const appRouter = router({
  orders: ordersRouter,
  products: productsRouter,
  inventory: inventoryRouter,
});

export type AppRouter = typeof appRouter;
