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
  createPreapprovalPlan,
  createSubscription,
} from "@/lib/services/billing/subscriptionService";
import {
    checkMpEntitlement,
    mpEntitlementMessage,
} from "@/lib/services/entitlements/checkEntitlement";
import {
    completeAccessRequest,
    getLatestAccessRequest,
    upsertAccessRequest,
} from "@/lib/services/mercadopago/accessRequestsService";
import {
    getCredentials,
    updateContactEmail,
    upsertCredentials,
} from "@/lib/services/mercadopago/credentialsService";
import {
    cancelActiveAttempt,
    getAttempt,
    getLatestAttempt,
} from "@/lib/services/mercadopago/statusService";
import { getMpPlatformConfig } from "@/lib/services/mercadopago/platformConfig";
import { getDb, sql } from "@/lib/sql/database";
import { getIsoTimestamp } from "@/utils/stamp";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../init";

// ─── Credentials sub-router ───────────────────────────────────────────────────

const credentialsRouter = router({
  /**
   * Returns the connection status for the current tenant.
   * Note: access_token is NEVER returned to the client.
   * Also includes the subscription/entitlement status so UI banners
   * can warn about past_due or grace_period states.
   */
  get: tenantProcedure.query(async ({ ctx }) => {
    const creds = await getCredentials({ tenantId: ctx.tenantId });
    if (!creds) return null;

    // Read entitlement row (may not exist when billing is not yet wired)
    const entitlement = await getDb()
      .selectFrom("tenant_entitlements")
      .select(["subscription_status", "grace_period_end"])
      .where("tenant_id", "=", ctx.tenantId)
      .executeTakeFirst();

    return {
      id: creds.id,
      appId: creds.app_id,
      userId: creds.user_id,
      contactEmail: creds.contact_email,
      status: creds.status,
      errorMessage: creds.error_message,
      createdAt: creds.created,
      // Subscription / entitlement — null when billing not yet enabled
      subscriptionStatus: entitlement?.subscription_status ?? null,
      gracePeriodEnd: entitlement?.grace_period_end ?? null,
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
   * Updates contact email for existing credentials.
   * Used to persist email hint before OAuth completion.
   */
  updateContactEmail: managerProcedure
    .input(
      z.object({
        contactEmail: z
          .string()
          .min(1, "Contact email is required")
          .email("Contact email must be valid"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await updateContactEmail({
        tenantId: ctx.tenantId,
        contactEmail: input.contactEmail.trim().toLowerCase(),
      });
      return { success: true };
    }),

  /**
   * Saves (or replaces) MP credentials for the tenant.
   * Requires manager role. access_token is write-only.
   */
  upsert: managerProcedure
    .input(
      z.object({
        accessToken: z.string().min(1, "Access token is required"),
        refreshToken: z.string().min(1).optional(),
        expiresInSeconds: z.number().int().positive().optional(),
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
        refreshToken: input.refreshToken,
        expiresInSeconds: input.expiresInSeconds,
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

      // Entitlement check — hard block when subscription inactive
      const ent = await checkMpEntitlement({ tenantId: ctx.tenantId });
      if (!ent.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: mpEntitlementMessage(ent.reason ?? "none"),
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

      if (amountCents <= 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "El total de la orden debe ser mayor a $0 para cobrar con Mercado Pago.",
        });
      }

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
      // Entitlement check (must have active sub to cancel — prevents orphan cancels)
      const ent = await checkMpEntitlement({ tenantId: ctx.tenantId });
      if (!ent.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: mpEntitlementMessage(ent.reason ?? "none"),
        });
      }

      await cancelActiveAttempt({
        orderId: input.orderId,
        tenantId: ctx.tenantId,
      });
      return { success: true };
    }),
});

// ─── Billing sub-router ───────────────────────────────────────────────────────

const billingRouter = router({
  /**
   * Activates platform billing for the current tenant.
   *
   * IMPORTANT: tenant assignment is always derived from the current session,
   * never manually selected. Payer email is taken from the tenant's linked
   * Mercado Pago OAuth contact email (settings flow).
   */
  activate: managerProcedure
    .input(
      z.object({
        reason: z.string().min(3),
        transactionAmount: z.number().positive(),
        currencyId: z.string().min(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const platformConfig = await getMpPlatformConfig();
      const normalizedBillingAccessToken =
        platformConfig.billingAccessToken?.trim() ?? "";
      if (!normalizedBillingAccessToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Platform billing token is not configured. Set MP_BILLING_ACCESS_TOKEN in platform configuration.",
        });
      }

      const platformSecrets = new Set(
        [
          platformConfig.clientId,
          platformConfig.clientSecret,
          platformConfig.webhookSecret,
          platformConfig.billingWebhookSecret,
          platformConfig.tokensEncryptionKey,
        ]
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value)),
      );

      if (platformSecrets.has(normalizedBillingAccessToken)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Billing Access Token must be unique and must not match platform Mercado Pago config values.",
        });
      }

      const creds = await getCredentials({ tenantId: ctx.tenantId });
      const payerEmail = creds?.contact_email?.trim() || "";

      if (!payerEmail) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Complete Mercado Pago OAuth email integration in Settings before activating billing.",
        });
      }

      const origin =
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        "https://orders.internetfriends.xyz";
      const backUrl = `${origin}/onboardings/configure-mp-billing`;

      const plan = await createPreapprovalPlan({
        accessToken: normalizedBillingAccessToken,
        reason: input.reason,
        transactionAmount: input.transactionAmount,
        currencyId: input.currencyId,
        backUrl,
      });

      const subscription = await createSubscription({
        accessToken: normalizedBillingAccessToken,
        preapprovalPlanId: plan.id,
        payerEmail,
        externalReference: ctx.tenantId,
        backUrl,
        reason: input.reason,
      });

      const now = getIsoTimestamp();

      await getDb()
        .insertInto("tenant_subscriptions")
        .values({
          tenant_id: ctx.tenantId,
          provider: "mercadopago",
          external_subscription_id: subscription.id,
          status: "active",
          metadata: {
            plan_id: plan.id,
            checkout_url: subscription.init_point ?? null,
            payer_email: payerEmail,
            reason: input.reason,
            amount: input.transactionAmount,
            currency_id: input.currencyId,
          },
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.columns(["tenant_id", "provider"]).doUpdateSet({
            external_subscription_id: subscription.id,
            status: "active",
            metadata: {
              plan_id: plan.id,
              checkout_url: subscription.init_point ?? null,
              payer_email: payerEmail,
              reason: input.reason,
              amount: input.transactionAmount,
              currency_id: input.currencyId,
            },
            updated_at: sql<Date>`CURRENT_TIMESTAMP`,
          }),
        )
        .execute();

      await getDb()
        .insertInto("tenant_entitlements")
        .values({
          tenant_id: ctx.tenantId,
          subscription_status: "active",
          features_enabled: ["mercadopago"],
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.column("tenant_id").doUpdateSet({
            subscription_status: "active",
            features_enabled: ["mercadopago"],
            updated_at: sql<Date>`CURRENT_TIMESTAMP`,
          }),
        )
        .execute();

      return {
        ok: true as const,
        tenantId: ctx.tenantId,
        payerEmail,
        planId: plan.id,
        subscriptionId: subscription.id,
        status: subscription.status,
        initPoint: subscription.init_point ?? null,
      };
    }),
});

// ─── Store sub-router ─────────────────────────────────────────────────────────

const storeRouter = router({
  /**
   * Creates or updates a Store / Branch in Mercado Pago.
   * Required for Point integration homologation (A1).
   */
  upsert: managerProcedure
    .input(
      z.object({
        name: z.string().min(1, "Store name is required"),
        externalId: z.string().min(1, "External ID is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ent = await checkMpEntitlement({ tenantId: ctx.tenantId });
      if (!ent.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: mpEntitlementMessage(ent.reason ?? "none"),
        });
      }
      const creds = await getCredentials({ tenantId: ctx.tenantId });
      if (!creds) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Mercado Pago not configured.",
        });
      }
      return dispatchDomainEvent({
        type: "mercadopago.store.upserted",
        payload: {
          tenantId: ctx.tenantId,
          mpUserId: creds.user_id,
          name: input.name,
          externalId: input.externalId,
        },
      });
    }),
});

// ─── POS sub-router ───────────────────────────────────────────────────────────

const posRouter = router({
  /**
   * Creates or updates a Point-of-Sale in Mercado Pago.
   * Required for Point integration homologation (A2).
   */
  upsert: managerProcedure
    .input(
      z.object({
        name: z.string().min(1, "POS name is required"),
        externalId: z.string().min(1, "External ID is required"),
        storeId: z.string().min(1, "Store ID is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ent = await checkMpEntitlement({ tenantId: ctx.tenantId });
      if (!ent.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: mpEntitlementMessage(ent.reason ?? "none"),
        });
      }
      const creds = await getCredentials({ tenantId: ctx.tenantId });
      if (!creds) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Mercado Pago not configured.",
        });
      }
      return dispatchDomainEvent({
        type: "mercadopago.pos.upserted",
        payload: {
          tenantId: ctx.tenantId,
          name: input.name,
          externalId: input.externalId,
          storeId: input.storeId,
        },
      });
    }),
});

// ─── Refund sub-router ────────────────────────────────────────────────────────

const refundRouter = router({
  /**
   * Issues a full or partial refund for a completed payment.
   * Good practice for Point integration (B1).
   */
  create: managerProcedure
    .input(
      z.object({
        paymentId: z.number().int().positive(),
        amount: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ent = await checkMpEntitlement({ tenantId: ctx.tenantId });
      if (!ent.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: mpEntitlementMessage(ent.reason ?? "none"),
        });
      }
      const creds = await getCredentials({ tenantId: ctx.tenantId });
      if (!creds) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Mercado Pago not configured.",
        });
      }
      return dispatchDomainEvent({
        type: "mercadopago.payment.refunded",
        payload: {
          tenantId: ctx.tenantId,
          paymentId: input.paymentId,
          amount: input.amount,
        },
      });
    }),
});

// ─── Device sub-router ────────────────────────────────────────────────────────

const deviceRouter = router({
  /**
   * Switches the operating mode of a Point terminal (PDV ↔ STANDALONE).
   * Good practice for merchant UX (B2).
   */
  switchMode: managerProcedure
    .input(
      z.object({
        deviceId: z.string().min(1, "Device ID is required"),
        operatingMode: z.enum(["PDV", "STANDALONE"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ent = await checkMpEntitlement({ tenantId: ctx.tenantId });
      if (!ent.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: mpEntitlementMessage(ent.reason ?? "none"),
        });
      }
      const creds = await getCredentials({ tenantId: ctx.tenantId });
      if (!creds) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Mercado Pago not configured.",
        });
      }
      return dispatchDomainEvent({
        type: "mercadopago.device.mode.switched",
        payload: {
          tenantId: ctx.tenantId,
          deviceId: input.deviceId,
          operatingMode: input.operatingMode,
        },
      });
    }),
});

// ─── Combined router ──────────────────────────────────────────────────────────

export const mercadopagoRouter = router({
  credentials: credentialsRouter,
  payment: paymentRouter,
  billing: billingRouter,
  store: storeRouter,
  pos: posRouter,
  refund: refundRouter,
  device: deviceRouter,
});
