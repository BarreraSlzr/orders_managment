"use server"

import { insertOrder } from "@/lib/sql/functions/insertOrder";
import { updateOrderItem } from "@/lib/sql/functions/updateOrderItem";
import { closeOrder } from "@/lib/sql/functions/closeOrder";
import { getProducts } from "@/lib/sql/functions/getProducts";
import { getOrder } from "@/lib/sql/functions/getOrder";
import { getOrderItemsDetailed } from "@/lib/sql/functions/getOrderItemsDetailed";
import { errorHandler } from "@/lib/utils/errorHandler";

export async function handleSelectProducts(formData: FormData) {
  return errorHandler({
    actionName: 'handleGetProducts',
    async callback() {
      const searchValue = `${formData.get('search')}`;
      const tagsValue = formData.getAll('tags').map(v => `${v}`);
      return getProducts(searchValue, tagsValue);
    },
    formData
  })
}

export async function handleInsertOrder(formData: FormData) {
  return errorHandler({
    actionName: 'handleCreateOrder',
    async callback () {
      const order = await insertOrder("America/Mexico_City");
      formData.append('orderId', order.id)
      if( formData.has('productId') ){
        const orderIdValue = order.id;
        const productIdValue = `${formData.get('productId')}`;
        await updateOrderItem(orderIdValue, productIdValue, 'INSERT');
      }
    },
    formData
  }).then((response) => {
    if (response.success) return handleSelectOrderItems(formData);
    return response;
  });
}

export async function handleUpdateOrderItem(formData: FormData) {
  return await errorHandler({
    actionName: 'handleUpdateOrderItem',
    async callback() {
      const typeValue = `${formData.get('type')}`;
      const orderIdValue = `${formData.get('orderId')}`;
      const productIdValue = `${formData.get('productId')}`;
      return updateOrderItem(orderIdValue, productIdValue, typeValue);
    },
    formData
  }).then((response) => {
    if (response.success) return handleSelectOrderItems(formData);
    return response;
  });
}

export async function handleCloseOrder(formData: FormData) {
  return errorHandler({
    actionName: 'handleCloseOrder',
    async callback() {
      const orderIdValue = `${formData.get('orderId')}`;
      return closeOrder(orderIdValue);
    },
    formData
  });
}

export async function handleSelectOrderItems(formData: FormData) {
  return errorHandler({
    actionName: 'getOrderItems',
    async callback() {
      const orderIdValue = `${formData.get('orderId')}`;
      const order = await getOrder(orderIdValue);
      const items = await getOrderItemsDetailed(order.id);
      return { order, items };
    },
    formData
  });
}
