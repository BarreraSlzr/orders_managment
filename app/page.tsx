import ProductOrderManagment from "@/components/ProductOrderManagment";
import { OrderItemsProductsProvider } from "@/context/useOrderItemsProducts";
import { OrdersProvider } from "@/context/useOrders";
import { ProductProvider } from "@/context/useProducts";
import { ProductsFilterProvider } from "@/context/useProductsFilter";
import { getFeatureAccessForCurrentSession } from "@/lib/services/entitlements/serverFeatureAccess";
import { OrdersQuery } from "@/lib/types";

export default async function Page() {
  const ordersQuery: OrdersQuery = {
    status: "opened",
  };

  const featureAccess = await getFeatureAccessForCurrentSession({
    features: ["quick_add_product", "order_expenses"],
    fallback: true,
  });
  const canQuickAddProduct = featureAccess.quick_add_product ?? true;
  const canOrderExpenses = featureAccess.order_expenses ?? true;

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
