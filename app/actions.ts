"use server"

import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { exportProductsJSON } from "@/lib/sql/functions/exportProductsJSON";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { getProducts } from "@/lib/sql/functions/getProducts";
import { Product } from "@/lib/types";
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
    async callback() {
      const order = await dispatchDomainEvent({
        type: "order.created",
        payload: {
          timeZone: "America/Mexico_City",
        },
      });
      formData.append('orderId', order.id)
      if (formData.has('productId')) {
        const orderIdValue = order.id;
        const productIdValue = `${formData.get('productId')}`;
        await dispatchDomainEvent({
          type: "order.item.updated",
          payload: {
            orderId: orderIdValue,
            productId: productIdValue,
            type: "INSERT",
          },
        });
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

      if (typeValue !== 'INSERT' && typeValue !== 'DELETE') {
        throw new Error(`Unexpected type: ${typeValue}`);
      }

      return dispatchDomainEvent({
        type: "order.item.updated",
        payload: {
          orderId: orderIdValue,
          productId: productIdValue,
          type: typeValue,
        },
      });
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
      const orderId = `${formData.get('orderId')}`;
      const item_ids = formData.getAll('item_id').map(ii => parseInt(`${ii}`));
      return dispatchDomainEvent({
        type: "order.split",
        payload: {
          oldOrderId: orderId,
          itemIds: item_ids,
        },
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
      return dispatchDomainEvent({
        type: "order.closed",
        payload: {
          orderId: orderIdValue,
        },
      });
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

      const product: Product = await dispatchDomainEvent({
        type: "product.upserted",
        payload: {
          id,
          name,
          price,
          tags,
        },
      });

      return { product };
    },
    formData
  });
}

export async function handleUpdatePayment(formData: FormData) {
  return errorHandler({
    actionName: 'handleUpdatePayment',
    callback() {
      const itemIds = formData.getAll('item_id').map(Number); // Get item IDs from formData
      const paymentOptionId = Number(formData.get('payment_option_id'));

      if (!itemIds.length || isNaN(paymentOptionId)) {
        throw new Error('Invalid data.');
      }

      return dispatchDomainEvent({
        type: "order.payment.toggled",
        payload: {
          itemIds,
        },
      });
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

      return dispatchDomainEvent({
        type: "order.takeaway.toggled",
        payload: {
          itemIds,
        },
      });
    },
    formData
  })
}

export async function handleRemoveProducts(formData: FormData) {
  return errorHandler({
    actionName: 'Remove Products',
    async callback() {
      const orderId = `${formData.get('orderId')}`;
      const itemIds = formData.getAll('item_id').map(id => parseInt(id as string, 10));

      if (!itemIds.length) {
        throw new Error('No items provided for removal.');
      }

      return (await dispatchDomainEvent({
        type: "order.products.removed",
        payload: {
          orderId,
          itemIds,
        },
      })).pop()?.numDeletedRows;
    },
    formData,
  });
}



export async function handleExportProducts(formData: FormData) {
  return errorHandler({
    actionName: 'handleExportProducts',
    async callback() {
      return {
        json: JSON.stringify((await exportProductsJSON())?.rows || [])
      }
    },
    formData
  })
}

export async function addNewItemAction(formData: FormData) {
  return errorHandler({
    actionName: 'addNewItem',
    async callback() {
      const name = formData.get('name')?.toString();
      const key = formData.get('quantity_type_key')?.toString();
      const categoryId = formData.get('categoryId')?.toString();
      if (name && name.trim() && key && key.trim()) {
        await dispatchDomainEvent({
          type: "inventory.item.added",
          payload: {
            name,
            quantityTypeKey: key,
            categoryId,
          },
        });
        return true;
      }
      return false;
    },
    formData,
  })
}

export async function toggleItemStatusAction(formData: FormData) {
  return errorHandler({
    actionName: 'toggleItemStatus',
    async callback() {
      const id = formData.get('id')?.toString();
      if (id && id.trim()) {
        await dispatchDomainEvent({
          type: "inventory.item.toggled",
          payload: {
            id,
          },
        });
        return true
      }
      return false
    },
    formData,
  })
}

export async function removeItemAction(formData: FormData) {
  return errorHandler({
    actionName: 'removeItem',
    async callback() {
      const id = formData.get('id')?.toString();
      if (id && id.trim()) {
        await dispatchDomainEvent({
          type: "inventory.item.deleted",
          payload: {
            id,
          },
        });
        return true
      }
      return false
    },
    formData,
  })
}

export async function addTransactionAction(formData: FormData) {
  return errorHandler({
    actionName: 'addTransaction',
    async callback() {
      const itemId = formData.get('item_id')?.toString();
      const type = formData.get('type')?.toString() as 'IN' | 'OUT';
      const price = parseFloat(formData.get('price')?.toString() || '0');
      const quantity = parseFloat(formData.get('quantity')?.toString() || '0');
      const quantityTypeValue = formData.get('quantity_type_value')?.toString();

      if (itemId && type && !isNaN(price) && !isNaN(quantity) && quantityTypeValue) {
        await dispatchDomainEvent({
          type: "inventory.transaction.added",
          payload: {
            itemId,
            type,
            price,
            quantity,
            quantityTypeValue,
          },
        });
      }
    },
    formData
  })
}

export async function deleteTransactionAction(formData: FormData) {
  return errorHandler({
    actionName: 'deleteTransaction',
    async callback() {
      const id = parseInt(formData.get('id')?.toString() || '0', 10);
      if (id) {
        await dispatchDomainEvent({
          type: "inventory.transaction.deleted",
          payload: {
            id,
          },
        })
      }
    },
    formData
  })
}

export async function removeCategoryAction(formData: FormData) {
  return errorHandler({
    formData,
    actionName: 'removeCategoryAction',
    async callback() {
      const id = formData.get('id')?.toString();
      if (!id) {
        throw new Error('Category ID is required');
      }
      return dispatchDomainEvent({
        type: "inventory.category.deleted",
        payload: {
          id,
        },
      });
    }
  })
}

export async function updateCategoryAction(formData: FormData) {
  return errorHandler({
    formData,
    actionName: 'updateCategoryAction',
    async callback() {
      const id = formData.get('id')?.toString();
      const name = formData.get('name')?.toString();
      if (!name) {
        throw new Error('Category name is required');
      }
      return dispatchDomainEvent({
        type: "inventory.category.upserted",
        payload: {
          id,
          name,
        },
      });
    }
  })
}

export async function toggleCategoryItemAction(formData: FormData) {
  return errorHandler({
    formData,
    actionName: 'updateCategoryAction',
    async callback() {
      const categoryId = formData.get('category_id')?.toString();
      const itemId = formData.get('item_id')?.toString();

      if (!categoryId || !itemId) {
        throw new Error('Both category ID and item ID are required');
      }
      return dispatchDomainEvent({
        type: "inventory.category.item.toggled",
        payload: {
          categoryId,
          itemId,
        },
      });
    }
  })
}