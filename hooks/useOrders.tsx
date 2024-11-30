'use client'
import { handleCloseOrder, handleInsertOrder, handleSelectOrderItems, handleUpdateOrderItem } from '@/app/actions';
import { Order, OrderItems, OrderItemsFE, Product } from '@/lib/types';
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';
import { useProducts } from './useProducts';

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
const getProductTagsSet = (products: Pick<Product, 'tags'>[]) => new Set(products.map(p => p.tags));

export function useOrders({ products: p, orders: os }: {
  products: Product[],
  orders: Order[]
}) {
  const [isPending, startTransition] = useTransition();
  const { products, ...apiProducts } = useProducts({ products: p });
  const [combinedTags, setCombinedTags] = useState(getProductTagsSet(Array.from(products.values())));
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
      return Array.from(products.values())
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
      return Array.from(products.values()); // No filtering if both are empty
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

  // Fetching orders
  const fetchOrders = async () => {
    const response = await fetch('/api/orders')
    if (!response.ok) throw new Error('Failed to fetch open orders')
    return response.json() as unknown as Order[]
  }

  useEffect(() => {
    async function fetchAll() {
      const orders = await fetchOrders()
      startTransition(() => {
        setOrders(new Map(orders.map(o => [o.id, o])))
      })
    }
    fetchAll();
  }, [])

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
    setSearchQuery,
    setSelectedTags,
    handleAddOrder: async function (productId?: string) {
      const formData = new FormData()
      if (productId) formData.append('productId', productId)
      const { message, success, result: orderUpdated } = await handleInsertOrder(formData);

      startTransition(async () => {
        if (success) updateOrder(orderUpdated);
      })
    },
    handleUpdateOrderItems: async function (productId: string, type: "INSERT" | "DELETE") {
      // Update order items logic
      if (!currentOrder) return
      const formData = new FormData()
      formData.append('orderId', currentOrder.order.id)
      formData.append('productId', productId)
      formData.append('type', type)
      const { success, result: orderUpdated } = await handleUpdateOrderItem(formData);

      startTransition(async () => {
        if (success) updateOrder(orderUpdated)
      })
    },
    handleCloseOrder: async function () {
      // Close order logic
      if (!currentOrder) return
      const formData = new FormData()
      formData.append('orderId', currentOrder.order.id)
      const { success } = await handleCloseOrder(formData)

      startTransition(async () => {
        if (success) {
          orders.delete(currentOrder.order.id);
          setOrders(new Map(orders));
        }
        updateOrder(null)
      })
    },
    setCurrentOrderDetails: async function (order: Order | null) {
      // Set current order logic
      if (!order) {
        updateOrder(null);
        return void 0;
      }
      const formData = new FormData()
      formData.append('orderId', order.id)
      const { success, result: orderUpdated } = await handleSelectOrderItems(formData);
      startTransition(async () => {
        if (success) updateOrder(orderUpdated)
      })
    },
    resetFilters() {
      setSearchQuery('');
      setSelectedTags(new Set());
    },
    ...apiProducts
  }
}