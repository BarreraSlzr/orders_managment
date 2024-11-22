'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { GetOrderItems, handleCloseOrder, handleCreateOrder, handleGetProducts, handleUpdateOrderItem } from './actions'
import { Order, OrderItems, Product } from '@/lib/types'

const getTagsSorted = (productTagsSet: Set<string>): string[] => {
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
    .sort(([, indexA], [, indexB]) => indexA - indexB)
    .map(([tag]) => tag);
}

const getProductTagsSet = (products: Product[]) => new Set(products.map(p => p.tags));

export default function ProductOrderWireframe() {
  const [isPending, startTransition] = useTransition()
  const [products, setProducts] = useState<Product[]>([])
  const [tagsSorted, setTagsSorted] = useState<string[]>([])
  const [combinedTags, setCombinedTags] = useState<Set<string>>(new Set)
  const [orders, setOrders] = useState<Order[]>([])
  const [currentOrder, setCurrentOrder] = useState<OrderItems | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set);
  const visibleProducts = useMemo(() => {
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
    if (!searchQuery && selectedTags.size === 0) {
      return products; // No filtering if both are empty
    } else {
      return filterAndSortProducts()
    }
  }, [searchQuery, selectedTags, products])
  const visibleTags = useMemo(() => {
    if (selectedTags.size === 0) {
      return tagsSorted;
    } else {
      const combinedTagsRelated = new Set(Array.from(combinedTags).filter(ct => Array.from(selectedTags).some(tag => ct.includes(tag))).join(',').split(','));
      return tagsSorted.filter(ts => combinedTagsRelated.has(ts));
    }
  }, [selectedTags, tagsSorted])

  const searchOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const { message, success, result: foundProducts } = await handleGetProducts(formData);
      if (success) setProducts(foundProducts)
    })
  }

  const addOrder = async () => {
    const formData = new FormData()
    formData.append('position', `${orders.length}`)
    startTransition(async () => {
      const { message, success, result: newOrder } = await handleCreateOrder(formData);
      if (success) setCurrentOrder({ order: newOrder, items: [] });
    })
  }

  const updateOrderItems = async (productId: string, type: "INSERT" | "DELETE") => {
    if (!currentOrder) return
    const formData = new FormData()
    formData.append('orderId', currentOrder.order.id)
    formData.append('productId', productId)
    formData.append('type', type)

    startTransition(async () => {
      const { result } = await handleUpdateOrderItem(formData);
      if( result ) setCurrentOrder(result)
    })
  }

  const setCurrentOrderDetails = async (order: Order) => {
    const formData = new FormData()
    formData.append('orderId', order.id)
    startTransition(async () => {
      setCurrentOrder(await GetOrderItems(formData))
    })
  }

  const closeOrder = async () => {
    if (!currentOrder) return
    const formData = new FormData()
    formData.append('orderId', currentOrder.order.id)
    startTransition(async () => {
      await handleCloseOrder(formData);
      setCurrentOrder(null)
    })
  }

  const handleTagToggle = (tag: string) => {
    selectedTags.has(tag) ? selectedTags.delete(tag) : selectedTags.add(tag);
    setSelectedTags(new Set(selectedTags));
  }

  // Fetching products
  const fetchProducts = async () => {
    const response = await fetch(`/api/products`)
    if (!response.ok) throw new Error('Failed to fetch products')
    return response.json() as unknown as Product[];
  }

  // Fetching tags
  const fetchOrders = async () => {
    const response = await fetch('/api/orders')
    if (!response.ok) throw new Error('Failed to fetch tags')
    return response.json() as unknown as Order[]
  }

  useEffect(() => {
    async function fetchAll() {
      const [products, orders] = await Promise.all([fetchProducts(), await fetchOrders()]);
      startTransition(() => {
        const combinedTags = getProductTagsSet(products)
        const tagsSorted = getTagsSorted(combinedTags);
        setProducts(products);
        setCombinedTags(combinedTags);
        setTagsSorted(tagsSorted)
        setOrders(orders);
      })
    }
    fetchAll();
  }, [])

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex justify-between items-center">
        {currentOrder && <>
          <Badge variant="outline">#{currentOrder.order.position} | ${currentOrder.order.total}</Badge>
          <Button variant="ghost" size="sm" disabled={isPending} onClick={closeOrder}>Close</Button>
        </>
        }
      </header>
      <div className="flex items-center space-x-2 overflow-x-auto py-2">
        <Badge onClick={addOrder}>New Order</Badge>
        {orders.map(order =>
          <Badge key={order.id} variant="secondary" onClick={() => setCurrentOrderDetails(order)}>#{order.position} | ${order.total} </Badge>)
        }
      </div>
      <form onSubmit={(ev) => ev.preventDefault()} className="space-y-2" onReset={() => {
        startTransition(() => {
          setSearchQuery('');
          setSelectedTags(new Set());
        })
      }}>
        <div className="relative">
          <Input
            name="search"
            placeholder="Search by name or tags..."
            className="pl-10 pr-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2"
            onClick={() => setSearchQuery('')}
          >
            <X />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.has(tag) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handleTagToggle(tag)}
            >
              {tag}
              <input type="checkbox" name="tags" value={tag} checked={selectedTags.has(tag)} className="sr-only" />
            </Badge>
          ))}
        </div>
        <Button type="reset">Limpiar</Button>
      </form>

      {visibleProducts.map((product) => (
        <Card key={product.id}>
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <h2 className="font-semibold">{product.name}</h2>
              <p className="text-sm text-gray-500">${product.price}</p>
            </div>
            <Button
              size="sm"
              onClick={() => updateOrderItems(product.id, "INSERT")}
              disabled={isPending || !currentOrder}
            >
              Add to Order
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}