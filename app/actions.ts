"use server"

import { insertOrder } from "@/lib/sql/functions/insertOrder";
import { updateOrderItem } from "@/lib/sql/functions/updateOrderItem";
import { closeOrder } from "@/lib/sql/functions/closeOrder";
import { getProducts } from "@/lib/sql/functions/getProducts";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { errorHandler } from "@/lib/utils/errorHandler";
import { Product } from "@/lib/types";
import { upsertProduct } from "@/lib/sql/functions/upsertProduct";
import { exportProductsJSON } from "@/lib/sql/functions/exportProductsJSON";
import { splitOrder } from "@/lib/sql/functions/splitOrder";
import { removeProducts, togglePaymentOption, toggleTakeAway } from "@/lib/sql/functions/updateTakeAway";

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

export async function handleSplitOrder(formData: FormData) {
  return await errorHandler({
    actionName: 'handleUpdateOrderItem',
    async callback() {
      const orderId =`${formData.get('orderId')}`;
      const item_ids = formData.getAll('item_id').map(ii => parseInt(`${ii}`));
      return await splitOrder({
        old_order_id: orderId,
        item_ids
      })
    },
    formData
  });
}

export async function handleCloseOrder(formData: FormData) {
  return errorHandler({
    actionName: 'handleCloseOrder',
    async callback() {
      const orderIdValue = `${formData.get('orderId')}`;
      return await closeOrder(orderIdValue);
    },
    formData
  });
}

export async function handleSelectOrderItems(formData: FormData) {
  return errorHandler({
    actionName: 'getOrderItems',
    async callback() {
      const orderIdValue = `${formData.get('orderId')}`;
      return getOrderItemsView(orderIdValue);
    },
    formData
  });
}

export async function handleUpsertProduct(formData: FormData) {
  return errorHandler({
    actionName: 'handleUpsertProduct',
    async callback() {
      const id = formData.get('id')?.toString() || '';
      const name = formData.get('name')?.toString() || '';
      const price = parseFloat(formData.get('price')?.toString() || '0');
      const tags = `${formData.get('tags')?.toString() || ''}`.replace(/\s*,\s*/g, ',');
    
      if (!name || isNaN(price)) {
        throw new Error('Invalid data: Name and price are required.');
      }
    
      const product: Product = await upsertProduct({
        id,
        name,
        price,
        tags,
      });
    
      return { product };
    },
    formData
  });
}

export async function handleUpdatePayment(formData: FormData) {
  return errorHandler({
    actionName: 'handleUpdatePayment',
    callback(){
      const itemIds = formData.getAll('item_id').map(Number); // Get item IDs from formData
      const paymentOptionId = Number(formData.get('payment_option_id'));
    
      if (!itemIds.length || isNaN(paymentOptionId)) {
        throw new Error('Invalid data.');
      }
     
      return togglePaymentOption(itemIds);
    },
    formData
  })
}

export async function handleToggleTakeAway(formData: FormData) {
  return errorHandler({
    actionName: 'handleToggleTakeAway',
    callback() {
      const itemIds = formData.getAll('item_id').map(Number); // Get item IDs from formData
    
      if (!itemIds.length) {
        throw new Error('Invalid data.');
      }
    
      return toggleTakeAway(itemIds);
    },
    formData
  })
}

export async function handleRemoveProducts(formData: FormData) {
  return errorHandler({
    actionName: 'Remove Products',
    async callback(){
      const orderId = `${formData.get('orderId')}`;
      const itemIds = formData.getAll('item_id').map(id => parseInt(id as string, 10));

      if (!itemIds.length) {
        throw new Error('No items provided for removal.');
      }

      return (await removeProducts(orderId, itemIds)).pop()?.numDeletedRows;
    },
    formData,
  });
}



export async function handleExportProducts(formData: FormData) {
  return errorHandler({
    actionName: 'handleExportProducts',
    async callback(){
        return {
          json: JSON.stringify((await exportProductsJSON())?.rows || [])
        }
    },
    formData
  }) 
}
