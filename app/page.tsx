import ProductOrderManagment from "@/components/ProductOrderManagment";
import { OrderItemsProductsProvider } from "@/context/useOrderItemsProducts";
import { OrdersProvider } from "@/context/useOrders";
import { ProductProvider } from "@/context/useProducts";
import { ProductsFilterProvider } from "@/context/useProductsFilter";
import { verifySessionToken } from "@/lib/auth/session";
import { peekFeatureAccess } from "@/lib/services/entitlements/featureGateService";
import { OrdersQuery } from "@/lib/types";
import { cookies } from "next/headers";

export default async function Page() {
  const ordersQuery: OrdersQuery = {
    status: "opened",
  };

  let canQuickAddProduct = true;
  let canOrderExpenses = true;

  try {
    const cookieStore = await cookies();
    const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
    const sessionToken = cookieStore.get(cookieName)?.value;

    if (sessionToken) {
      const session = await verifySessionToken(sessionToken);
      if (session?.tenant_id) {
        canQuickAddProduct = await peekFeatureAccess({
          tenantId: session.tenant_id,
          feature: "quick_add_product",
        });
        canOrderExpenses = await peekFeatureAccess({
          tenantId: session.tenant_id,
          feature: "order_expenses",
        });
      }
    }
  } catch {
    canQuickAddProduct = true;
    canOrderExpenses = true;
  }

  return (
    <OrdersProvider query={ordersQuery}>
      <ProductProvider>
        <ProductsFilterProvider>
          <OrderItemsProductsProvider>
            <ProductOrderManagment
              featureFlags={{
                canQuickAddProduct,
                canOrderExpenses,
              }}
            />
          </OrderItemsProductsProvider>
        </ProductsFilterProvider>
      </ProductProvider>
    </OrdersProvider>
  );
}
