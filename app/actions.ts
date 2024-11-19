"use server"

import { addOrder } from "@/lib/sql/functions/addOrder";
import { updateOrderItem } from "@/lib/sql/functions/updateOrderItem";
import { closeOrder } from "@/lib/sql/functions/closeOrder";
import { getProducts } from "@/lib/sql/functions/getProducts";
import { getOrder } from "@/lib/sql/functions/getOrder";

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

export async function handleUpdateOrderItem(formData: FormData) {
    const quantityValue = parseInt(`${formData.get('quantity')}`);
    const orderIdValue = `${formData.get('orderId')}`;
    const productIdValue = `${formData.get('productId')}`;
    const orderItem = await updateOrderItem(orderIdValue, productIdValue, quantityValue);
    const order = await getOrder(orderIdValue);
    return {order};
}

export async function handleCloseOrder(formData: FormData) {
    const orderIdValue = parseInt(`${formData.get('orderId')}`);
    const order = await closeOrder(orderIdValue);
    return order;
}