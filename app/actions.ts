"use server"

import { getAuthConfig } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";
import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { exportProductsJSON } from "@/lib/sql/functions/exportProductsJSON";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { getProducts } from "@/lib/sql/functions/getProducts";
import { Product } from "@/lib/types";
import { errorHandler } from "@/lib/utils/errorHandler";
import { cookies } from "next/headers";

async function requireTenantId(): Promise<string> {
  const { cookieName } = getAuthConfig();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(cookieName)?.value;
  if (!sessionToken) {
    throw new Error("Missing session cookie");
  }
  const session = await verifySessionToken(sessionToken);
  if (!session?.tenant_id) {
    throw new Error("Missing tenant scope");
  }
  return session.tenant_id;
}

export async function handleSelectProducts(formData: FormData) {
  return errorHandler({
    actionName: 'handleGetProducts',
    async callback() {
      const tenantId = await requireTenantId();
      const searchValue = `${formData.get('search')}`;
      const tagsValue = formData.getAll('tags').map(v => `${v}`);
      return getProducts({
        tenantId,
        search: searchValue,
        tags: tagsValue,
      });
    },
    formData
  })
}

export async function handleInsertOrder(formData: FormData) {
  return errorHandler({
    actionName: 'handleCreateOrder',
    async callback() {
      const tenantId = await requireTenantId();
      const order = await dispatchDomainEvent({
        type: "order.created",
        payload: {
          tenantId,
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
            tenantId,
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
      const tenantId = await requireTenantId();
      const typeValue = `${formData.get('type')}`;
      const orderIdValue = `${formData.get('orderId')}`;
      const productIdValue = `${formData.get('productId')}`;

      if (typeValue !== 'INSERT' && typeValue !== 'DELETE') {
        throw new Error(`Unexpected type: ${typeValue}`);
      }

      return dispatchDomainEvent({
        type: "order.item.updated",
        payload: {
          tenantId,
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
      const tenantId = await requireTenantId();
      const orderId = `${formData.get('orderId')}`;
      const item_ids = formData.getAll('item_id').map(ii => parseInt(`${ii}`));
      return dispatchDomainEvent({
        type: "order.split",
        payload: {
          tenantId,
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
      const tenantId = await requireTenantId();
      const orderIdValue = `${formData.get('orderId')}`;
      return dispatchDomainEvent({
        type: "order.closed",
        payload: {
          tenantId,
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
      const tenantId = await requireTenantId();
      const orderIdValue = `${formData.get('orderId')}`;
      return getOrderItemsView({ tenantId, orderId: orderIdValue });
    },
    formData
  });
}

export async function handleUpsertProduct(formData: FormData) {
  return errorHandler({
    actionName: 'handleUpsertProduct',
    async callback() {
      const tenantId = await requireTenantId();
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
          tenantId,
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
    async callback() {
      const tenantId = await requireTenantId();
      const itemIds = formData.getAll('item_id').map(Number); // Get item IDs from formData
      const paymentOptionId = Number(formData.get('payment_option_id'));

      if (!itemIds.length || isNaN(paymentOptionId)) {
        throw new Error('Invalid data.');
      }

      return dispatchDomainEvent({
        type: "order.payment.toggled",
        payload: {
          tenantId,
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
    async callback() {
      const tenantId = await requireTenantId();
      const itemIds = formData.getAll('item_id').map(Number); // Get item IDs from formData

      if (!itemIds.length) {
        throw new Error('Invalid data.');
      }

      return dispatchDomainEvent({
        type: "order.takeaway.toggled",
        payload: {
          tenantId,
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
      const tenantId = await requireTenantId();
      const orderId = `${formData.get('orderId')}`;
      const itemIds = formData.getAll('item_id').map(id => parseInt(id as string, 10));

      if (!itemIds.length) {
        throw new Error('No items provided for removal.');
      }

      return (await dispatchDomainEvent({
        type: "order.products.removed",
        payload: {
          tenantId,
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
      const tenantId = await requireTenantId();
      return {
        json: JSON.stringify((await exportProductsJSON({ tenantId }))?.rows || [])
      }
    },
    formData
  })
}

export async function addNewItemAction(formData: FormData) {
  return errorHandler({
    actionName: 'addNewItem',
    async callback() {
      const tenantId = await requireTenantId();
      const name = formData.get('name')?.toString();
      const key = formData.get('quantity_type_key')?.toString();
      const categoryId = formData.get('categoryId')?.toString();
      if (name && name.trim() && key && key.trim()) {
        await dispatchDomainEvent({
          type: "inventory.item.added",
          payload: {
            tenantId,
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
      const tenantId = await requireTenantId();
      const id = formData.get('id')?.toString();
      if (id && id.trim()) {
        await dispatchDomainEvent({
          type: "inventory.item.toggled",
          payload: {
            tenantId,
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
      const tenantId = await requireTenantId();
      const id = formData.get('id')?.toString();
      if (id && id.trim()) {
        await dispatchDomainEvent({
          type: "inventory.item.deleted",
          payload: {
            tenantId,
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
      const tenantId = await requireTenantId();
      const itemId = formData.get('item_id')?.toString();
      const type = formData.get('type')?.toString() as 'IN' | 'OUT';
      const price = parseFloat(formData.get('price')?.toString() || '0');
      const quantity = parseFloat(formData.get('quantity')?.toString() || '0');
      const quantityTypeValue = formData.get('quantity_type_value')?.toString();

      if (itemId && type && !isNaN(price) && !isNaN(quantity) && quantityTypeValue) {
        await dispatchDomainEvent({
          type: "inventory.transaction.upserted",
          payload: {
            tenantId,
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
      const tenantId = await requireTenantId();
      const id = parseInt(formData.get('id')?.toString() || '0', 10);
      if (id) {
        await dispatchDomainEvent({
          type: "inventory.transaction.deleted",
          payload: {
            tenantId,
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
      const tenantId = await requireTenantId();
      const id = formData.get('id')?.toString();
      if (!id) {
        throw new Error('Category ID is required');
      }
      return dispatchDomainEvent({
        type: "inventory.category.deleted",
        payload: {
          tenantId,
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
      const tenantId = await requireTenantId();
      const id = formData.get('id')?.toString();
      const name = formData.get('name')?.toString();
      if (!name) {
        throw new Error('Category name is required');
      }
      return dispatchDomainEvent({
        type: "inventory.category.upserted",
        payload: {
          tenantId,
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
      const tenantId = await requireTenantId();
      const categoryId = formData.get('category_id')?.toString();
      const itemId = formData.get('item_id')?.toString();

      if (!categoryId || !itemId) {
        throw new Error('Both category ID and item ID are required');
      }
      return dispatchDomainEvent({
        type: "inventory.category.item.toggled",
        payload: {
          tenantId,
          categoryId,
          itemId,
        },
      });
    }
  })
}