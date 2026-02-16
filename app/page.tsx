import ProductOrderManagment from "@/components/ProductOrderManagment";
import { OrderItemsProductsProvider } from "@/context/useOrderItemsProducts";
import { OrdersProvider } from "@/context/useOrders";
import { ProductProvider } from "@/context/useProducts";
import { ProductsFilterProvider } from "@/context/useProductsFilter";
import { OrdersQuery } from "@/lib/types";

export default function Page() {
  const ordersQuery: OrdersQuery = {
    status: "opened",
  };

  return (
    <OrdersProvider query={ordersQuery}>
      <ProductProvider>
        <ProductsFilterProvider>
          <OrderItemsProductsProvider>
            <ProductOrderManagment />
          </OrderItemsProductsProvider>
        </ProductsFilterProvider>
      </ProductProvider>
    </OrdersProvider>
  );
}
