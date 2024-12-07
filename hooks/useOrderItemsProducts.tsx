'use client'
import { handleInsertOrder, handleUpdateOrderItem } from '@/app/actions';
import { useOrders } from '@/context/useOrders';
import { useProducts } from '@/context/useProducts';
import { Order, OrderContextType, Product } from '@/lib/types';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

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

export function useOrderItemsProducts(): OrderContextType {
  const { products, ...apiProducts } = useProducts();
  const {
    isPending,
    currentOrder,
    orders,
    startTransition,
    setOrders,
    handleCloseOrder,
    setCurrentOrderDetails,
    updateCurrentOrder,
    handleSplitOrder,
    handleUpdateItemDetails,
    fetchOrders
  } = useOrders();
  const [combinedTags, setCombinedTags] = useState(getProductTagsSet(Array.from(products.values())));
  const [tagsSorted, setTagsSorted] = useState<[string, number][]>(getTagsSorted(combinedTags));
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


  return {
    isPending,
    tagsSorted,
    currentOrder,
    orders,
    searchQuery,
    selectedTags,
    visibleProducts,
    visibleTags,
    setSearchQuery,
    setSelectedTags,
    handleSplitOrder,
    handleUpdateItemDetails,
    handleCloseOrder,
    setCurrentOrderDetails,
    fetchOrders,
    handleAddOrder: async function (productId?: string) {
      const formData = new FormData()
      if (productId) formData.append('productId', productId)
      const { message, success, result: orderUpdated } = await handleInsertOrder(formData);
      startTransition(async () => {
        if (success) updateCurrentOrder(orderUpdated);
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
        if (success) updateCurrentOrder(orderUpdated)
      })
    },
    resetFilters() {
      setSearchQuery('');
      setSelectedTags(new Set());
    },
    ...apiProducts
  }
}