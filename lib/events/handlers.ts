import { checkMpEntitlement } from "@/lib/services/entitlements/checkEntitlement";
import {
    getCredentials,
    markCredentialsError,
} from "@/lib/services/mercadopago/credentialsService";
import {
    createPDVPaymentIntent,
    createQRPayment,
    listTerminals,
    switchDeviceMode,
} from "@/lib/services/mercadopago/paymentService";
import { createPos, listPos } from "@/lib/services/mercadopago/posService";
import { createRefund } from "@/lib/services/mercadopago/refundService";
import {
    createAttempt,
    updateAttempt,
} from "@/lib/services/mercadopago/statusService";
import { createStore, listStores } from "@/lib/services/mercadopago/storeService";
import { createAdminAuditLog } from "@/lib/sql/functions/adminAudit";
import { batchCloseOrders } from "@/lib/sql/functions/batchCloseOrders";
import {
    deleteCategory,
    toggleCategoryItem,
    upsertCategory,
} from "@/lib/sql/functions/categories";
import { closeOrder } from "@/lib/sql/functions/closeOrder";
import { combineOrders } from "@/lib/sql/functions/combineOrders";
import { deductDayConsumptions } from "@/lib/sql/functions/deductDayConsumptions";
import {
    deleteExtra,
    toggleOrderItemExtra,
    upsertExtra,
} from "@/lib/sql/functions/extras";
import { insertOrder } from "@/lib/sql/functions/insertOrder";
import {
    addItem,
    deleteItem,
    toggleItem,
} from "@/lib/sql/functions/inventory";
import { openOrder } from "@/lib/sql/functions/openOrder";
import {
    addProductConsumption,
    removeProductConsumption,
} from "@/lib/sql/functions/productConsumptions";
import { splitOrder } from "@/lib/sql/functions/splitOrder";
import {
    deleteTransaction,
    upsertTransaction,
} from "@/lib/sql/functions/transactions";
import { updateOrderItem } from "@/lib/sql/functions/updateOrderItem";
import {
    removeProducts,
    setPaymentOption,
    togglePaymentOption,
    toggleTakeAway,
} from "@/lib/sql/functions/updateTakeAway";
import { upsertProduct } from "@/lib/sql/functions/upsertProduct";
import {
    DomainEventPayloadMap,
    DomainEventResultMap,
    DomainEventType,
} from "./contracts";

interface EventHandlerParams<TType extends DomainEventType> {
  payload: DomainEventPayloadMap[TType];
}

type DomainEventHandler<TType extends DomainEventType> = (
  params: EventHandlerParams<TType>
) => Promise<DomainEventResultMap[TType]>;

export const domainEventHandlers: {
  [TType in DomainEventType]: DomainEventHandler<TType>;
} = {
  "order.created": async ({ payload }) => {
    return insertOrder({ tenantId: payload.tenantId, timeZone: payload.timeZone });
  },
  "order.item.updated": async ({ payload }) => {
    return updateOrderItem({
      tenantId: payload.tenantId,
      orderId: payload.orderId,
      productId: payload.productId,
      type: payload.type,
      // Apply admin defaults from client (lazily synced)
      defaultPaymentOptionId: payload.defaultPaymentOptionId,
      defaultIsTakeaway: payload.defaultIsTakeaway,
    });
  },
  "order.split": async ({ payload }) => {
    return splitOrder({
      tenantId: payload.tenantId,
      oldOrderId: payload.oldOrderId,
      itemIds: payload.itemIds,
    });
  },
  "order.combined": async ({ payload }) => {
    return combineOrders({
      tenantId: payload.tenantId,
      targetOrderId: payload.targetOrderId,
      sourceOrderIds: payload.sourceOrderIds,
    });
  },
  "order.closed": async ({ payload }) => {
    return closeOrder({ tenantId: payload.tenantId, orderId: payload.orderId });
  },
  "order.opened": async ({ payload }) => {
    return openOrder({ tenantId: payload.tenantId, orderId: payload.orderId });
  },
  "order.payment.toggled": async ({ payload }) => {
    return togglePaymentOption({
      tenantId: payload.tenantId,
      itemIds: payload.itemIds,
    });
  },
  "order.payment.set": async ({ payload }) => {
    return setPaymentOption({
      tenantId: payload.tenantId,
      itemIds: payload.itemIds,
      paymentOptionId: payload.paymentOptionId,
    });
  },
  "order.takeaway.toggled": async ({ payload }) => {
    return toggleTakeAway({ tenantId: payload.tenantId, itemIds: payload.itemIds });
  },
  "order.products.removed": async ({ payload }) => {
    const rows = await removeProducts({
      tenantId: payload.tenantId,
      orderId: payload.orderId,
      itemIds: payload.itemIds,
    });
    // Kysely returns numDeletedRows as a native BigInt; convert to number
    // so the result is JSON-serializable over tRPC / Server Actions.
    return rows.map((r) => ({ numDeletedRows: Number(r.numDeletedRows) }));
  },
  "product.upserted": async ({ payload }) => {
    return upsertProduct({
      tenantId: payload.tenantId,
      id: payload.id,
      name: payload.name,
      price: payload.price,
      tags: payload.tags,
    });
  },
  "inventory.item.added": async ({ payload }) => {
    const newItem = await addItem({
      tenantId: payload.tenantId,
      name: payload.name,
      quantityTypeKey: payload.quantityTypeKey,
    });

    if (newItem && payload.categoryId) {
      const categoryStatus = await toggleCategoryItem({
        tenantId: payload.tenantId,
        categoryId: payload.categoryId,
        itemId: newItem.id,
      });
      return {
        id: newItem.id,
        categoryStatus,
      };
    }

    return {
      id: newItem.id,
    };
  },
  "inventory.item.toggled": async ({ payload }) => {
    return toggleItem({ tenantId: payload.tenantId, id: payload.id });
  },
  "inventory.item.deleted": async ({ payload }) => {
    return deleteItem({ tenantId: payload.tenantId, id: payload.id });
  },
  "inventory.transaction.upserted": async ({ payload }) => {
    return upsertTransaction({
      tenantId: payload.tenantId,
      itemId: payload.itemId,
      type: payload.type,
      price: payload.price,
      quantity: payload.quantity,
      quantityTypeValue: payload.quantityTypeValue,
      id: payload.id,
    });
  },
  "inventory.transaction.deleted": async ({ payload }) => {
    return deleteTransaction({ tenantId: payload.tenantId, id: payload.id });
  },
  "inventory.category.upserted": async ({ payload }) => {
    return upsertCategory({
      tenantId: payload.tenantId,
      name: payload.name,
      id: payload.id,
    });
  },
  "inventory.category.deleted": async ({ payload }) => {
    return deleteCategory({ tenantId: payload.tenantId, id: payload.id });
  },
  "inventory.category.item.toggled": async ({ payload }) => {
    return toggleCategoryItem({
      tenantId: payload.tenantId,
      categoryId: payload.categoryId,
      itemId: payload.itemId,
    });
  },
  "extra.upserted": async ({ payload }) => {
    return upsertExtra({
      tenantId: payload.tenantId,
      id: payload.id,
      name: payload.name,
      price: payload.price,
    });
  },
  "extra.deleted": async ({ payload }) => {
    return deleteExtra({ tenantId: payload.tenantId, id: payload.id });
  },
  "order.item.extra.toggled": async ({ payload }) => {
    return toggleOrderItemExtra({
      tenantId: payload.tenantId,
      orderItemId: payload.orderItemId,
      extraId: payload.extraId,
    });
  },
  "admin.audit.logged": async ({ payload }) => {
    return createAdminAuditLog({
      action: payload.action,
      adminId: payload.adminId,
      role: payload.role,
      tenantId: payload.tenantId,
      targetTenantId: payload.targetTenantId,
      metadata: payload.metadata ?? null,
    });
  },

  "order.payment.mercadopago.start": async ({ payload }) => {
    const { tenantId, orderId, amountCents, flow } = payload;

    // Entitlement check — mirrors the tRPC guard so direct dispatches
    // cannot bypass the soft-gate when ENTITLEMENT_ENABLED=true
    const entitlement = await checkMpEntitlement({ tenantId });
    if (!entitlement.allowed) {
      throw new Error(
        `Tenant ${tenantId} is not entitled to Mercado Pago features (status: ${entitlement.reason}).`,
      );
    }

    // Fetch stored credentials
    const creds = await getCredentials({ tenantId });
    if (!creds) {
      throw new Error(
        "Mercado Pago credentials not configured for this tenant.",
      );
    }

    // Create the attempt record first (idempotency guard inside)
    const attempt = await createAttempt({ tenantId, orderId, amountCents });

    // Mark as processing
    await updateAttempt({ id: attempt.id, status: "processing" });

    try {
      if (flow === "qr") {
        // QR flow
        const qrResult = await createQRPayment({
          accessToken: creds.access_token,
          mpUserId: creds.user_id,
          externalReference: orderId,
          amountCents,
        });

        await updateAttempt({
          id: attempt.id,
          status: "pending",
          qrCode: qrResult.qr_data,
          mpTransactionId: qrResult.in_store_order_id,
          responseData: qrResult as unknown as Record<string, unknown>,
        });

        return {
          attemptId: attempt.id,
          status: "pending" as const,
          qrCode: qrResult.qr_data,
          mpTransactionId: qrResult.in_store_order_id,
        };
      } else {
        // PDV flow — use the first terminal
        const terminals = await listTerminals({
          accessToken: creds.access_token,
        });
        const terminal = terminals[0];
        if (!terminal) {
          throw new Error("No Point terminals registered for this account.");
        }

        const pdvResult = await createPDVPaymentIntent({
          accessToken: creds.access_token,
          deviceId: terminal.id,
          amountCents,
          externalReference: orderId,
        });

        await updateAttempt({
          id: attempt.id,
          status: "processing",
          terminalId: terminal.id,
          mpTransactionId: pdvResult.id,
          responseData: pdvResult as unknown as Record<string, unknown>,
        });

        return {
          attemptId: attempt.id,
          status: "processing" as const,
          terminalId: terminal.id,
          mpTransactionId: pdvResult.id,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown MP error";

      await updateAttempt({
        id: attempt.id,
        status: "error",
        errorData: { message: errorMessage },
      });
      await markCredentialsError({ tenantId, errorMessage });

      throw error;
    }
  },

  "mercadopago.credentials.upserted": async ({ payload }) => {
    // Get-or-create Store + POS so re-OAuth does not create duplicates.
    // list* first — MP returns 400 for duplicate external_id otherwise.
    const creds = await getCredentials({ tenantId: payload.tenantId });
    if (creds) {
      const externalStoreId = `tenant_${payload.tenantId}`;
      const externalPosId = `orders_pdv_${payload.tenantId}`;

      try {
        const existingStores = await listStores({
          accessToken: creds.access_token,
          mpUserId: payload.userId,
        });

        const store =
          existingStores.find((s) => s.external_id === externalStoreId) ??
          (await createStore({
            accessToken: creds.access_token,
            mpUserId: payload.userId,
            name: `Tenant ${payload.tenantId}`,
            externalId: externalStoreId,
          }));

        const existingPos = await listPos({
          accessToken: creds.access_token,
          storeId: store.id,
        });

        const posAlreadyExists = existingPos.some(
          (p) => p.external_id === externalPosId,
        );

        if (!posAlreadyExists) {
          await createPos({
            accessToken: creds.access_token,
            name: "Caja principal",
            externalId: externalPosId,
            storeId: store.id,
          });
          console.info(
            `[mp-onboard] Provisioned Store ${store.id} + POS ${externalPosId} for tenant ${payload.tenantId}`,
          );
        } else {
          console.info(
            `[mp-onboard] Store ${store.id} + POS ${externalPosId} already exist for tenant ${payload.tenantId} — skipping`,
          );
        }
      } catch (err) {
        // Best-effort: do not block the OAuth flow on provision failure
        console.warn("[mp-onboard] Auto-provision Store+POS failed:", err);
      }
    }

    return { credentialsId: `${payload.tenantId}:${payload.appId}` };
  },

  "product.consumption.added": async ({ payload }) => {
    return addProductConsumption({
      tenantId: payload.tenantId,
      productId: payload.productId,
      itemId: payload.itemId,
      quantity: payload.quantity,
      quantityTypeValue: payload.quantityTypeValue,
      isTakeaway: payload.isTakeaway,
    });
  },

  "product.consumption.removed": async ({ payload }) => {
    return removeProductConsumption({
      tenantId: payload.tenantId,
      id: payload.id,
    });
  },

  "order.batch.closed": async ({ payload }) => {
    const { closedOrderIds } = await batchCloseOrders({
      tenantId: payload.tenantId,
      date: payload.date,
    });
    const deductedItems = await deductDayConsumptions({
      tenantId: payload.tenantId,
      date: payload.date,
    });
    return { closedOrderIds, deductedItems };
  },

  "inventory.eod.reconciled": async ({ payload }) => {
    const deductedItems = await deductDayConsumptions({
      tenantId: payload.tenantId,
      date: payload.date,
    });
    return { deductedItems };
  },

  "mercadopago.store.upserted": async ({ payload }) => {
    const creds = await getCredentials({ tenantId: payload.tenantId });
    if (!creds) throw new Error("MP credentials not configured");

    const store = await createStore({
      accessToken: creds.access_token,
      mpUserId: payload.mpUserId,
      name: payload.name,
      externalId: payload.externalId,
    });
    return { storeId: store.id };
  },

  "mercadopago.pos.upserted": async ({ payload }) => {
    const creds = await getCredentials({ tenantId: payload.tenantId });
    if (!creds) throw new Error("MP credentials not configured");

    const pos = await createPos({
      accessToken: creds.access_token,
      name: payload.name,
      externalId: payload.externalId,
      storeId: payload.storeId,
    });
    return { posId: pos.id, externalId: pos.external_id };
  },

  "mercadopago.payment.refunded": async ({ payload }) => {
    const creds = await getCredentials({ tenantId: payload.tenantId });
    if (!creds) throw new Error("MP credentials not configured");

    const refund = await createRefund({
      accessToken: creds.access_token,
      paymentId: String(payload.paymentId),
      amount: payload.amount,
    });
    return { refundId: refund.id, status: refund.status };
  },

  "mercadopago.device.mode.switched": async ({ payload }) => {
    const creds = await getCredentials({ tenantId: payload.tenantId });
    if (!creds) throw new Error("MP credentials not configured");

    const terminal = await switchDeviceMode({
      accessToken: creds.access_token,
      deviceId: payload.deviceId,
      operatingMode: payload.operatingMode,
    });
    return { deviceId: terminal.id, operatingMode: terminal.operating_mode };
  },
};
