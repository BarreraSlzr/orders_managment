/**
 * mercadopagoRouter — tRPC procedures for Mercado Pago integration.
 *
 * Namespace: mercadopago.*
 *
 * credentials.get      — tenantProcedure  — read current MP credentials status
 * credentials.upsert   — managerProcedure — save / replace MP credentials
 * payment.start        — managerProcedure — initiate payment sync for a closed order
 * payment.status       — tenantProcedure  — poll latest sync attempt for an order
 * payment.cancel       — managerProcedure — cancel an in-progress sync attempt
 */
import { dispatchDomainEvent } from "@/lib/events/dispatch";
import {
  completeAccessRequest,
  getLatestAccessRequest,
  upsertAccessRequest,
} from "@/lib/services/mercadopago/accessRequestsService";
import {
  getCredentials,
  upsertCredentials,
} from "@/lib/services/mercadopago/credentialsService";
import {
  cancelActiveAttempt,
  getAttempt,
  getLatestAttempt,
} from "@/lib/services/mercadopago/statusService";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../init";

// ─── Credentials sub-router ───────────────────────────────────────────────────

const credentialsRouter = router({
  /**
   * Returns the connection status for the current tenant.
   * Note: access_token is NEVER returned to the client.
   */
  get: tenantProcedure.query(async ({ ctx }) => {
    const creds = await getCredentials({ tenantId: ctx.tenantId });
    if (!creds) return null;

    return {
      id: creds.id,
      appId: creds.app_id,
      userId: creds.user_id,
      contactEmail: creds.contact_email,
      status: creds.status,
      errorMessage: creds.error_message,
      createdAt: creds.created,
    };
  }),

  /**
   * Returns the latest access request for MP OAuth.
   */
  accessRequest: tenantProcedure.query(async ({ ctx }) => {
    const request = await getLatestAccessRequest({ tenantId: ctx.tenantId });
    if (!request) return null;

    return {
      id: request.id,
      contactEmail: request.contact_email,
      status: request.status,
      requestedAt: request.requested_at,
      updatedAt: request.updated_at,
      completedAt: request.completed_at,
    };
  }),

  /**
   * Creates or updates a pending access request for MP OAuth.
   */
  requestAccess: managerProcedure
    .input(
      z.object({
        contactEmail: z
          .string()
          .min(1, "Contact email is required")
          .email("Contact email must be valid"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return upsertAccessRequest({
        tenantId: ctx.tenantId,
        contactEmail: input.contactEmail,
      });
    }),

  /**
   * Checks if OAuth is configured (environment variables present).
   * Used by UI to show/hide OAuth button.
   */
  checkOAuth: tenantProcedure.query(async () => {
    const available = !!(
      process.env.MP_CLIENT_ID &&
      process.env.MP_CLIENT_SECRET &&
      process.env.MP_REDIRECT_URI
    );
    return { available };
  }),

  /**
   * Saves (or replaces) MP credentials for the tenant.
   * Requires manager role. access_token is write-only.
   */
  upsert: managerProcedure
    .input(
      z.object({
        accessToken: z.string().min(1, "Access token is required"),
        appId: z.string().min(1, "App ID is required"),
        userId: z.string().min(1, "MP User ID is required"),
        contactEmail: z
          .string()
          .min(1, "Contact email is required")
          .email("Contact email must be valid"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const creds = await upsertCredentials({
        tenantId: ctx.tenantId,
        accessToken: input.accessToken,
        appId: input.appId,
        userId: input.userId,
        contactEmail: input.contactEmail,
      });

      await completeAccessRequest({
        tenantId: ctx.tenantId,
        contactEmail: input.contactEmail,
      });

      // Dispatch audit event (credentials stored pre-event)
      await dispatchDomainEvent({
        type: "mercadopago.credentials.upserted",
        payload: {
          tenantId: ctx.tenantId,
          appId: creds.app_id,
          userId: creds.user_id,
        },
      });

      return {
        id: creds.id,
        appId: creds.app_id,
        userId: creds.user_id,
        status: creds.status,
      };
    }),
});

// ─── Payment sub-router ───────────────────────────────────────────────────────

const paymentRouter = router({
  /**
   * Starts a Mercado Pago payment sync for a closed order.
   * Dispatches `order.payment.mercadopago.start` which:
   *   1. Fetches stored credentials
   *   2. Creates a payment_sync_attempts record
   *   3. Calls the MP API (QR or PDV)
   *   4. Returns attemptId + status + QR data / terminalId
   */
  start: managerProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        flow: z.enum(["qr", "pdv"]).default("pdv"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify credentials exist before dispatching
      const creds = await getCredentials({ tenantId: ctx.tenantId });
      if (!creds) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Mercado Pago not configured. Add your credentials in Settings → Mercado Pago.",
        });
      }

      // Fetch order total from DB (amount_cents = total * 100)
      const order = await getOrderItemsView({
        tenantId: ctx.tenantId,
        orderId: input.orderId,
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (!order.closed) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only closed orders can be charged via Mercado Pago.",
        });
      }

      const amountCents = Math.round(order.total * 100);

      return dispatchDomainEvent({
        type: "order.payment.mercadopago.start",
        payload: {
          tenantId: ctx.tenantId,
          orderId: input.orderId,
          amountCents,
          flow: input.flow,
        },
      });
    }),

  /**
   * Returns the latest sync attempt for an order.
   * Used by the UI to poll payment status.
   */
  status: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getLatestAttempt({
        orderId: input.orderId,
        tenantId: ctx.tenantId,
      });
    }),

  /**
   * Polls a specific attempt by ID.
   */
  attempt: tenantProcedure
    .input(z.object({ attemptId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const attempt = await getAttempt({
        id: input.attemptId,
        tenantId: ctx.tenantId,
      });
      if (!attempt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });
      }
      return attempt;
    }),

  /**
   * Cancels any in-progress sync attempt so a new one can be started.
   */
  cancel: managerProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await cancelActiveAttempt({
        orderId: input.orderId,
        tenantId: ctx.tenantId,
      });
      return { success: true };
    }),
});

// ─── Combined router ──────────────────────────────────────────────────────────

export const mercadopagoRouter = router({
  credentials: credentialsRouter,
  payment: paymentRouter,
});
