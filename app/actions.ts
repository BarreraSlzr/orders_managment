"use server"

import { addOrder } from "@/lib/sql/functions/addOrder";
import { updateOrderItem } from "@/lib/sql/functions/updateOrderItem";
import { closeOrder } from "@/lib/sql/functions/closeOrder";
import { getProducts } from "@/lib/sql/functions/getProducts";
import { getOrder } from "@/lib/sql/functions/getOrder";
import { getOrderItemsDetailed } from "@/lib/sql/functions/getOrderItemsDetailed";
import { OrderItems } from "@/lib/types";

export async function handleGetProducts(formData: FormData) {
    const searchValue = `${formData.get('search')}`;
    const tagsValue = formData.getAll('tags').map(v => `${v}`);
    const products = await getProducts(searchValue, tagsValue);
    return products;
}

export async function handleCreateOrder(formData: FormData) {
    const positionValue = parseInt(`${formData.get('position')}`);
    return addOrder(positionValue);
}

export async function handleUpdateOrderItem(formData: FormData): Promise<OrderItems> {
    const typeValue = `${formData.get('type')}`;
    const orderIdValue = `${formData.get('orderId')}`;
    const productIdValue = `${formData.get('productId')}`;
    await updateOrderItem(orderIdValue, productIdValue, typeValue);
    return GetOrderItems(formData)
}

export async function GetOrderItems(formData: FormData): Promise<OrderItems> {
    const orderIdValue = `${formData.get('orderId')}`;
    const order = await getOrder(orderIdValue);
    const items = await getOrderItemsDetailed(order.id);
    return {order, items};
}

export async function handleCloseOrder(formData: FormData) {
    const orderIdValue = `${formData.get('orderId')}`;
    const order = await closeOrder(orderIdValue);
    return order;
}