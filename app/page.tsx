'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Minus, Plus, Search, X } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { handleSelectOrderItems, handleInsertOrder, handleUpdateOrderItem, handleCloseOrder } from './actions'
import { Order, OrderItem, OrderItems, OrderItemsFE, Product } from '@/lib/types'
import { formatPrice } from '@/lib/utils/formatPrice'
import { ProductCard } from '@/components/ProductCard'


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
  const [ShowDetail, setShowDetail] = useState(false)

  function toggleDetail() {
    setShowDetail(!ShowDetail)
  }

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

  const fp = (value?: number) => formatPrice(value || 0)

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

  const addOrder = (withProduct?: string) => () => {
    const formData = new FormData()
    if (withProduct) formData.append('productId', withProduct)
    startTransition(async () => {
      const { message, success, result: orderUpdated } = await handleInsertOrder(formData);
      if (success) updateOrder(orderUpdated);
    })
  }

  const updateOrderItems = (productId: string, type: "INSERT" | "DELETE") => () => {
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

  const setCurrentOrderDetails = (order: Order) => () => {
    const formData = new FormData()
    formData.append('orderId', order.id)
    startTransition(async () => {
      const { success, result: orderUpdated } = await handleSelectOrderItems(formData);
      if (success) updateOrder(orderUpdated)
    })
  }

  const closeOrder = async () => {
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
    if (!response.ok) throw new Error('Failed to fetch open orders')
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
        <Button className='whitespace-nowrap' onClick={addOrder()}>Crear orden</Button>
        {currentOrder && <>
          <div className="flex gap-2">
            <Badge variant="outline">#{currentOrder.order.position} | {fp(currentOrder.order.total)}</Badge>
            <Button variant='destructive' size="sm" disabled={isPending} onClick={closeOrder}>Cerrar orden</Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => updateOrder(null)}
            >
              <X />
            </Button>
          </div>
        </>
        }
      </header>
      <div className="flex flex-wrap gap-2 py-2">
        {Array.from(orders.values()).map(order =>
          <Badge key={order.id}
            variant="secondary"
            onClick={setCurrentOrderDetails(order)}
            hidden={(currentOrder?.order.id || 'x') === order.id}
            className='flex flex-col text-right'
          >
            <span>#{order.position}</span>
            <span className='whitespace-nowrap'>{fp(order.total)}</span>
          </Badge>)
        }
      </div>
      <form onSubmit={(ev) => ev.preventDefault()} className="space-y-2" onReset={() =>
        startTransition(() => {
          setSearchQuery('');
          setSelectedTags(new Set());
        })
      }>
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
              <input type="checkbox" name="tags" value={tag} readOnly checked={selectedTags.has(tag)} className="sr-only" />
            </Badge>
          ))}
        </div>
        <Button type="reset">Limpiar</Button>
      </form>
      {visibleProducts.map((product) => (
        <Card key={product.id}>
          <CardContent className="p-4 flex justify-between items-center">
            <ProductCard
              key={product.id}
              product={product}
              currentOrder={currentOrder}
              handleAddOrder={addOrder}
              handleUpdateOrderItems={updateOrderItems}
              isPending={isPending} />
          </CardContent>
        </Card>
      ))
      }

      <footer className="sticky bottom-0 translate-y-2 pb-2 max-w-md w-full">
        {!!currentOrder?.items &&
          <Card className='py-4 translate-y-8'>
            <CardHeader className='pt-1 px-4'>
              <Button variant='ghost' size='sm' onClick={toggleDetail}>
                <b> Productos seleccionados ({[currentOrder.items.values()].reduce((acc, its) => acc + its.toArray().reduce((acc2, its) => acc2 + its.quantity, 0), 0)})</b>
                {
                  ShowDetail ?
                    <ArrowDown />
                    :
                    <ArrowUp />
                }
              </Button>
            </CardHeader>
            {ShowDetail &&
              <CardContent className='flex flex-col' >
                {products
                  .filter(p => currentOrder?.items.has(p.id))
                  .map(product => <ProductCard
                    key={product.id}
                    product={product}
                    currentOrder={currentOrder}
                    handleAddOrder={addOrder}
                    handleUpdateOrderItems={updateOrderItems}
                    isPending={isPending} />
                  )
                }
              </CardContent>
            }
          </Card>}
        <Card className='w-full sticky bottom-0'>
          <CardContent className='flex flex-col'>
            <div>
              <div className="flex flex-wrap gap-2 py-2">
                {Array.from(orders.values()).map(order => (
                  <Badge
                    key={order.id}
                    variant="secondary"
                    onClick={() => setCurrentOrderDetails(order)}
                    hidden={currentOrder?.order.id === order.id}
                    className="flex flex-col text-right"
                  >
                    <span>#{order.position}</span>
                    <span>{formatPrice(order.total)}</span>
                  </Badge>
                ))}
              </div>
            </div>
            <div className='flex justify-between items-center gap-2'>
              <Button onClick={() => addOrder()}>Crear orden</Button>
              {currentOrder?.order && (
                <div className="flex gap-2">
                  <Badge variant="outline">#{currentOrder.order.position} | {formatPrice(currentOrder.order.total)}</Badge>
                  <Button variant="destructive" size="sm" disabled={isPending} onClick={closeOrder}>
                    Cerrar orden
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentOrder(null)}>
                    <X />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </footer>
    </div>
  )
}