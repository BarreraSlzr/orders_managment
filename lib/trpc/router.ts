import { router } from "./init";
import { adminRouter } from "./routers/admin";
import { extrasRouter } from "./routers/extras";
import { inventoryRouter } from "./routers/inventory";
import { mercadopagoRouter } from "./routers/mercadopago";
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
  mercadopago: mercadopagoRouter,
});

export type AppRouter = typeof appRouter;
