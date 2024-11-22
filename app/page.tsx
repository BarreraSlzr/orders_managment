'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { Minus, Plus, Search, X } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { handleGetOrderItems, handleCreateOrder, handleGetProducts, handleUpdateOrderItem } from './actions'
import { Order, OrderItem, OrderItems, Product } from '@/lib/types'
import { formatPrice } from '@/lib/util/formatPrice'

interface OrderItemsFE {
  order: Order,
  items: Map<OrderItem['product_id'], OrderItem>
}

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

const colorsByIndex = ["indigo", "blue", "sky", "cyan"]

export default function ProductOrderWireframe() {
  const [isPending, startTransition] = useTransition()
  const [products, setProducts] = useState<Product[]>([])
  const [tagsSorted, setTagsSorted] = useState<[string, number][]>([])
  const [combinedTags, setCombinedTags] = useState<Set<string>>(new Set)
  const [orders, setOrders] = useState<Map<Order['id'], Order>>(new Map)
  const [currentOrder, setCurrentOrder] = useState<OrderItemsFE | null>(null)
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
      return tagsSorted.filter(([ts]) => combinedTagsRelated.has(ts));
    }
  }, [selectedTags, tagsSorted])

  const fp = (value?: number) => formatPrice(value || 0, navigator?.language || 'es-MX', 'MXN')

  function updateOrder(value: OrderItems | null) {
    if (value !== null) {
      orders.set(value.order.id, value.order);
      setOrders(new Map(orders));
      setCurrentOrder({
        order: value.order,
        items: new Map(value.items.map(it => [it.product_id, it]))
      })
    } else {
      setCurrentOrder(null);
    }
  }

  const addOrder = async () => {
    const formData = new FormData()
    formData.append('position', `${orders.size + 1}`)
    startTransition(async () => {
      const { message, success, result: newOrder } = await handleCreateOrder(formData);
      if (success) updateOrder({ order: newOrder, items: [] });
    })
  }

  const updateOrderItems = async (productId: string, type: "INSERT" | "DELETE") => {
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

  const setCurrentOrderDetails = async (order: Order) => {
    const formData = new FormData()
    formData.append('orderId', order.id)
    startTransition(async () => {
      const { success, result: orderUpdated } = await handleGetOrderItems(formData);
      if (success) updateOrder(orderUpdated)
    })
  }

  const closeOrder = async () => {
    if (!currentOrder) return
    const formData = new FormData()
    formData.append('orderId', currentOrder.order.id)
    startTransition(async () => {
      // await handleCloseOrder(formData);
      updateOrder(null)
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
      const [products, orders] = await Promise.all([fetchProducts(), await fetchOrders()])
      startTransition(() => {
        const combinedTags = getProductTagsSet(products)
        const tagsSorted = getTagsSorted(combinedTags)
        setProducts(products)
        setCombinedTags(combinedTags)
        setTagsSorted(tagsSorted)
        setOrders(new Map(orders.map(o => [o.id, o])))
      })
    }
    fetchAll();
  }, [])

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex justify-between items-center">
        {currentOrder && <>
          <Badge variant="outline">#{currentOrder.order.position} | {fp(currentOrder.order.total)}</Badge>
          <Button variant="ghost" size="sm" disabled={isPending} onClick={closeOrder}>Cerrar</Button>
        </>
        }
      </header>
      <div className="flex items-center space-x-2 overflow-x-auto py-2">
        <Badge onClick={addOrder}>Nueva orden (#{orders.size + 1})</Badge>
        {Array.from(orders.values()).map(order =>
          <Badge key={order.id} hidden={(currentOrder?.order.id || 'x') === order.id} variant="secondary" onClick={() => setCurrentOrderDetails(order)}>#{order.position} | {fp(order.total)} </Badge>)
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
            type="reset"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2"
          >
            <X />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleTags.map(([tag, tagIndex]) => (
            <Badge
              key={tag}
              variant={selectedTags.has(tag) ? "default" : "outline"}
              className={"cursor-pointer"
                /* selectedTags.has(tag) ? `
                bg-${colorsByIndex[tagIndex]}-500 hover:bg-${colorsByIndex[tagIndex]}-600
                text-white
              ` : `border-${colorsByIndex[tagIndex]}-500
                text-${colorsByIndex[tagIndex]}-700 dark:text-${colorsByIndex[tagIndex]}-300
                hover:bg-${colorsByIndex[tagIndex]}-100 dark:hover:bg-${colorsByIndex[tagIndex]}-900` */
              }
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
              <p className="text-sm text-gray-500">{fp(product.price)}</p>
            </div>
            {
              currentOrder ?
                !!currentOrder.items.get(product.id) ?
                  <div className="inline-flex items-center rounded-md border border-input bg-background shadow-sm">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateOrderItems(product.id, "INSERT")}
                      aria-label="Insert"
                      className="rounded-l-md px-2 h-8"
                      disabled={isPending}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <div className="w-8 h-8 flex items-center justify-center border-l border-r border-input text-xs font-medium">
                      {currentOrder.items.get(product.id)?.quantity}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateOrderItems(product.id, "DELETE")}
                      aria-label="Delete"
                      disabled={currentOrder.items.get(product.id)?.quantity === 0 || isPending}
                      className="rounded-r-md px-2 h-8"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  </div>
                  : <Button
                    size="sm"
                    onClick={() => updateOrderItems(product.id, "INSERT")}
                    disabled={isPending}
                  >
                    Agregar
                  </Button>
                :
                <Button
                  size="sm"
                  onClick={() => startTransition(async () => {
                    await addOrder()
                    await updateOrderItems(product.id, "INSERT")
                  })
                  }
                  disabled={isPending}
                >
                  Crear orden
                </Button>
            }
          </CardContent>
        </Card>
      ))}
    </div>
  )
}