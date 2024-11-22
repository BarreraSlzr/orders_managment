"use server"

import { addOrder } from "@/lib/sql/functions/addOrder";
import { updateOrderItem } from "@/lib/sql/functions/updateOrderItem";
import { closeOrder } from "@/lib/sql/functions/closeOrder";
import { getProducts } from "@/lib/sql/functions/getProducts";
import { getOrder } from "@/lib/sql/functions/getOrder";
import { getOrderItemsDetailed } from "@/lib/sql/functions/getOrderItemsDetailed";
import { OrderItems } from "@/lib/types";

export async function handleGetProducts(formData: FormData) {
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

export async function handleCreateOrder(formData: FormData) {
  return errorHandler({
    actionName: 'handleCreateOrder',
    callback() {
      const positionValue = parseInt(`${formData.get('position')}`);
      return addOrder(positionValue);
    },
    formData
  })
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
    if (response.success) return handleGetOrderItems(formData);
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

export async function handleGetOrderItems(formData: FormData) {
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

type ServerActionCallback<T> = () => Promise<T>;

interface ErrorHandlerProps<T> {
  actionName: string;
  callback: ServerActionCallback<T>;
  formData: FormData;
}

async function errorHandler<T>({ actionName, callback, formData }: ErrorHandlerProps<T>): Promise<
  { success: true, message: string, result: T } |
  { success: false, message: string, result: null }
> {
  try {
    // Log the formData for inspection
    console.log(`Action: ${actionName} - Form Data: `, formData);

    // Execute the server action callback
    const result = await callback() as T;
    console.log(`Action: ${actionName} - Result: `, result);

    // Return success response
    return { success: true, message: `${actionName} successed`, result };
  } catch (error) {
    // Log the error for debugging
    console.error(`Error in ${actionName}: `, error);

    // You can provide custom error handling depending on the error type
    if (error instanceof Error) {
      // Handle database or known errors
      if (JSON.stringify(error).includes('23505')) {
        // Example: Handle unique constraint violations (PostgreSQL)
        return { success: false, message: 'Duplicate entry detected.', result: null };
      }

      // Generic database or unknown errors
      return { success: false, message: 'Database error occurred.', result: null };
    }

    // If the error is not an instance of Error, provide a fallback message
    return { success: false, message: 'An unknown error occurred.', result: null };
  }
}