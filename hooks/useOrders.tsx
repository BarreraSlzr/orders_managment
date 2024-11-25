'use client'
import { handleCloseOrder, handleInsertOrder, handleSelectOrderItems, handleUpdateOrderItem } from '@/app/actions';
import { Order, OrderContextType, OrderItems, OrderItemsFE, Product } from '@/lib/types';
import { createContext, PropsWithChildren, useCallback, useContext, useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';

const getTagsSorted = (productTagsSet: Set<string>): [string, number][] => {
  const tagIndices: Record<string, number> = {};

  // Iterate through each tag string in the Set
  Array.from(productTagsSet).forEach((tags) => {
    // Split the tags string and trim whitespace
    tags.split(',').forEach((tag, tagIndex) => {
      // Update the tag's index if it's not present or the new index is smaller
      if (!(tag in tagIndices) || tagIndices[tag] > tagIndex) {
        tagIndices[tag] = tagIndex;
      }
    });
  });
  return Object.entries(tagIndices)
    .sort(([, indexA], [, indexB]) => indexA - indexB);
}
const getProductTagsSet = (products: Product[]) => new Set(products.map(p => p.tags));

export function useOrders({ products: p, orders: os }: {
  products: Product[],
  orders: Order[]
}) {
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState<Product[]>(p);
  const [combinedTags, setCombinedTags] = useState(getProductTagsSet(p));
  const [tagsSorted, setTagsSorted] = useState<[string, number][]>(getTagsSorted(combinedTags));
  const [orders, setOrders] = useState(new Map<Order['id'], Order>(os.map(o => [o.id, o])));
  const [currentOrder, setCurrentOrder] = useState<OrderItemsFE | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState(new Set<string>());

  // Use deferred values for debouncing
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredSelectedTags = useDeferredValue(selectedTags);

  const visibleProducts = useMemo(() => {
    // Filtering and sorting logic
    function filterAndSortProducts() {
      return products
        .map((product) => {
          const productTags = product.tags.split(',').map((tag) => tag.trim());
          const nameMatch = searchQuery
            ? product.name.toLowerCase().includes(searchQuery.toLowerCase())
            : false;
          const matchedTags = selectedTags.size > 0
            ? productTags.filter((tag) => selectedTags.has(tag))
            : [];
          const weight =
            (nameMatch ? searchQuery.length : 0) + matchedTags.length * 10;

          return { product, weight };
        })
        .filter(({ weight }) => weight > 0)
        .sort((a, b) => b.weight - a.weight)
        .map(({ product }) => product);
    }
    if (!deferredSearchQuery && deferredSelectedTags.size === 0) {
      return products; // No filtering if both are empty
    } else {
      return filterAndSortProducts()
    }
  }, [deferredSearchQuery, deferredSelectedTags, products]);

  const visibleTags = useMemo(() => {
    // Filtering tags logic
    if (selectedTags.size === 0) {
      return tagsSorted;
    } else {
      const combinedTagsRelated = new Set(
        Array
          .from(combinedTags)
          .filter(ct =>
            Array
              .from(selectedTags)
              .some(tag => ct.includes(tag))
          )
          .join(',')
          .split(',')
      );
      return tagsSorted.filter(([ts]) => combinedTagsRelated.has(ts));
    }
  }, [selectedTags, tagsSorted]);

  const updateOrder = useCallback(function (value: OrderItems | null) {
    try {
      if (value !== null) {
        orders.set(value.order.id, value.order);
        setOrders(new Map(orders));
        setCurrentOrder({
          ...{
            order: value.order,
            items: new Map(value.items.map(it => [it.product_id, it]))
          }
        })
      } else {
        setCurrentOrder(null);
      }
    } catch (error) {
      console.log({ orderUpdate: { error } });
    } finally {
      console.log({ orderUpdate: value })
    }
  }, [orders])

  function handleAddOrder(productId?: string) {
    // Add order logic
    const formData = new FormData()
    if (productId) formData.append('productId', productId)
    startTransition(async () => {
      const { message, success, result: orderUpdated } = await handleInsertOrder(formData);
      if (success) updateOrder(orderUpdated);
    })
  }

  function handleUpdateOrderItems(productId: string, type: "INSERT" | "DELETE") {
    // Update order items logic
    if (!currentOrder) return
    const formData = new FormData()
    formData.append('orderId', currentOrder.order.id)
    formData.append('productId', productId)
    formData.append('type', type)

    startTransition(async () => {
      const { success, result: orderUpdated } = await handleUpdateOrderItem(formData);
      if (success) updateOrder(orderUpdated)
    })
  }

  const closeOrder = useCallback(function () {
    // Close order logic
    if (!currentOrder) return
    const formData = new FormData()
    formData.append('orderId', currentOrder.order.id)
    startTransition(async () => {
      const { success } = await handleCloseOrder(formData)
      if (success) {
        orders.delete(currentOrder.order.id);
        setOrders(new Map(orders));
      }
      updateOrder(null)
    })
  }, [orders])

  function setCurrentOrderDetails(order: Order | null) {
    // Set current order logic
    if (!order) {
      updateOrder(null);
      return void 0;
    }
    const formData = new FormData()
    formData.append('orderId', order.id)
    startTransition(async () => {
      const { success, result: orderUpdated } = await handleSelectOrderItems(formData);
      if (success) updateOrder(orderUpdated)
    })
  }

  function resetFilters() {
    setSearchQuery('');
    setSelectedTags(new Set());
  }

  return {
    isPending,
    products,
    tagsSorted,
    currentOrder,
    orders,
    searchQuery,
    selectedTags,
    visibleProducts,
    visibleTags,
    handleAddOrder: useCallback(handleAddOrder, [orders]),
    handleUpdateOrderItems: useCallback(handleUpdateOrderItems, [orders]),
    handleCloseOrder: useCallback(closeOrder, [orders]),
    setSearchQuery: setSearchQuery,
    setSelectedTags: setSelectedTags,
    setCurrentOrderDetails: useCallback(setCurrentOrderDetails, [orders]),
    resetFilters: resetFilters,
  }
}