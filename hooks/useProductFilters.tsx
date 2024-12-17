'use client'
import { useProducts } from '@/context/useProducts';
import {  Product, ProductFilterContextActions, ProductFilterContextState } from '@/lib/types';
import { cleanString } from '@/lib/utils/cleanString';
import { useDeferredValue,  useMemo, useState } from 'react';

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

export function useProductsFilter(): ProductFilterContextState & ProductFilterContextActions {
  const { products } = useProducts();
  const combinedTags = useMemo(() => getProductTagsSet(Array.from(products.values())), [products]);
  const tagsSorted = useMemo<[string, number][]>(() => getTagsSorted(combinedTags), [combinedTags]);
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
              ? cleanString(product.name).includes(cleanString(searchQuery))
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
      return filterAndSortProducts();
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
  }, [selectedTags, tagsSorted, combinedTags]);

  const handleTagToggle = (tag: string) => {
    selectedTags.has(tag) ? selectedTags.delete(tag) : selectedTags.add(tag);
    setSelectedTags(new Set(selectedTags));
  };

  return {
    tagsSorted,
    searchQuery,
    selectedTags,
    visibleProducts,
    visibleTags,
    setSearchQuery,
    setSelectedTags,
    handleTagToggle,
    resetFilters() {
      setSearchQuery('');
      setSelectedTags(new Set());
    }
  }
}