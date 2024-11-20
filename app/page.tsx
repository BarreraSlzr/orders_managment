'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { handleCloseOrder, handleCreateOrder, handleGetProducts, handleUpdateOrderItem } from './actions'
import { Order, OrderItem, Product } from '@/lib/types'
import { getOrderItemsDetailed } from '@/lib/sql/functions/getOrderItemsDetailed'
import { getOrder } from '@/lib/sql/functions/getOrder'

export default function ProductOrderWireframe() {
  const [isPending, startTransition] = useTransition()
  const [products, setProducts] = useState<Product[]>([])
  const [tags, setTags] = useState<Set<string>>(new Set)
  const [combinedTags, setCombinedTags] = useState<Set<string>>(new Set)
  const [orders, setOrders] = useState<Order[]>([])
  const [currentOrder, setCurrentOrder] = useState<{ details: Order, items: OrderItem[] } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set);

  const searchOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const foundProducts = await handleGetProducts(formData)
      setProducts(foundProducts)
    })
  }

  const addOrder = async () => {
    const formData = new FormData()
    formData.append('position', `${orders.length}`)
    startTransition(async () => {
      const newOrder = await handleCreateOrder(formData)
      setCurrentOrder({ details: newOrder, items: [] });
    })
  }

  const addToOrder = async (productId: string, quantity: number) => {
    if (!currentOrder) return
    const formData = new FormData()
    formData.append('orderId', currentOrder.details.id)
    formData.append('productId', productId)
    formData.append('quantity', `${quantity}`)

    startTransition(async () => {
      await handleUpdateOrderItem(formData)
      const details = await getOrder(currentOrder.details.id);
      const items = await getOrderItemsDetailed(details.id);
      setCurrentOrder({ details, items })
    })
  }

  const setCurrentOrderDetails = async (order: Order) => {
    startTransition(async () => {
      const details = await getOrder(order.id);
      const items = await getOrderItemsDetailed(details.id);
      setCurrentOrder({ details, items })
    })
  }

  const closeOrder = async () => {
    if (!currentOrder) return
    const formData = new FormData()
    formData.append('orderId', currentOrder.details.id)
    startTransition(async () => {
      await handleCloseOrder(formData);
      setCurrentOrder(null)
    })
  }

  const handleTagToggle = (tag: string) => {
    selectedTags.has(tag) ? selectedTags.delete(tag) : selectedTags.add(tag);
    if (selectedTags.size === 0) {
      setTags(new Set(getUniqueTags()));
    } else {
      const combinedTagsRelated = Array.from(combinedTags).filter(ct => Array.from(selectedTags).some(tag => ct.includes(tag)));
      setTags(getUniqueTags(combinedTagsRelated));
    }
    setSelectedTags(new Set(selectedTags));
  }

  // Fetching products
  const fetchProducts = async () => {
    const response = await fetch(`/api/products`)
    if (!response.ok) throw new Error('Failed to fetch products')
    return response.json() as unknown as Product[];
  }

  // Fetching tags
  const fetchTags = async () => {
    const response = await fetch('/api/tags')
    if (!response.ok) throw new Error('Failed to fetch tags')
    return response.json() as unknown as string[]
  }

  // Fetching tags
  const fetchOrders = async () => {
    const response = await fetch('/api/orders')
    if (!response.ok) throw new Error('Failed to fetch tags')
    return response.json() as unknown as Order[]
  }

  useEffect(() => {
    async function fetchAll() {
      const products = await fetchProducts();
      const tags = await fetchTags();
      const orders = await fetchOrders();
      setProducts(products);
      const combinedTags = new Set(products.map(p => p.tags));
      const uniqueTags = getUniqueTags(combinedTags);
      setCombinedTags(combinedTags);
      setTags(uniqueTags);
      setOrders(orders);
    }
    fetchAll();
  }, [])

  const getUniqueTags = (tags: string[] | Set<string> = combinedTags) => new Set(Array.from(tags).join(','));

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex justify-between items-center">
        {currentOrder && <>
          <Badge variant="outline">#{currentOrder.details.id} | {currentOrder.details.total}</Badge>
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
      <form onSubmit={searchOrder} className="space-y-2">
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
          {Array.from(tags).map((tag) => (
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

        <Button type="submit" disabled={isPending}>Search</Button>
      </form>

      {products.map((product) => (
        <Card key={product.id}>
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <h2 className="font-semibold">{product.name}</h2>
              <p className="text-sm text-gray-500">${product.price}</p>
            </div>
            <Button
              size="sm"
              onClick={() => addToOrder(product.id, 1)}
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