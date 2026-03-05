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
import { featureGateService } from "@/lib/services/entitlements/featureGateService";
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
import { getMpPlatformConfig } from "@/lib/services/mercadopago/platformConfig";
import {
  cancelActiveAttempt,
  getAttempt,
  getLatestAttempt,
} from "@/lib/services/mercadopago/statusService";
import { getDb, sql } from "@/lib/sql/database";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import type { FeatureKey } from "@/lib/sql/types";
import { getIsoTimestamp } from "@/utils/stamp";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../init";

const BILLING_FEATURE_PRICING_FALLBACK: Record<FeatureKey, number> = {
  sales_history_extended: 49,
  mercadopago_sync: 299,
  multi_manager_users: 99,
  payment_method_advanced: 59,
  quick_add_product: 39,
  order_expenses: 69,
  product_composition: 79,
};

const BILLING_FEATURE_LABELS: Record<FeatureKey, string> = {
  sales_history_extended: "Historial de ventas extendido",
  mercadopago_sync: "Sincronización Mercado Pago",
  multi_manager_users: "Multi-manager users",
  payment_method_advanced: "Métodos de pago avanzados",
  quick_add_product: "Quick add de productos",
  order_expenses: "Gestión de gastos por orden",
  product_composition: "Composición de producto",
};

const featureKeySchema = z.enum([
  "sales_history_extended",
  "mercadopago_sync",
  "multi_manager_users",
  "payment_method_advanced",
  "quick_add_product",
  "order_expenses",
  "product_composition",
]);

const DISCOUNT_PREVIEW_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 180,
};

let discountPreviewHits: number[] = [];

function assertGlobalDiscountPreviewRateLimit(): void {
  const now = Date.now();
  const minTs = now - DISCOUNT_PREVIEW_RATE_LIMIT.windowMs;
  discountPreviewHits = discountPreviewHits.filter((ts) => ts >= minTs);

  if (discountPreviewHits.length >= DISCOUNT_PREVIEW_RATE_LIMIT.maxRequests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many discount preview requests. Try again in a minute.",
    });
  }

  discountPreviewHits.push(now);
}

async function resolveDiscountCode(params: {
  tenantId: string;
  discountCode: string;
  baseAmount: number;
  selectedFeatureKeys: FeatureKey[];
}): Promise<{
  codeId: string;
  code: string;
  kind: "amount_off" | "feature_unlock";
  appliedAmount: number;
  unlockFeatureKeys: FeatureKey[];
  unlockDays: number;
}> {
  const normalizedCode = params.discountCode.trim().toUpperCase();
  if (!normalizedCode) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Discount code inválido.",
    });
  }

  const row = await getDb()
    .selectFrom("discount_codes")
    .select([
      "id",
      "code",
      "kind",
      "amount_type",
      "amount_value",
      "unlock_days",
      "feature_keys",
      "active",
      "starts_at",
      "ends_at",
      "max_redemptions",
      "redeemed_count",
    ])
    .where(sql`UPPER(code)`, "=", normalizedCode)
    .executeTakeFirst();

  if (!row || !row.active) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Discount code no existe o está inactivo.",
    });
  }

  const nowMs = Date.now();
  const startsMs = row.starts_at ? new Date(row.starts_at).getTime() : null;
  const endsMs = row.ends_at ? new Date(row.ends_at).getTime() : null;

  if (typeof startsMs === "number" && startsMs > nowMs) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Discount code aún no está vigente.",
    });
  }

  if (typeof endsMs === "number" && endsMs < nowMs) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Discount code expirado.",
    });
  }

  if (
    typeof row.max_redemptions === "number"
    && row.max_redemptions > 0
    && row.redeemed_count >= row.max_redemptions
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Discount code sin redenciones disponibles.",
    });
  }

  const alreadyRedeemed = await getDb()
    .selectFrom("discount_redemptions")
    .select("id")
    .where("discount_code_id", "=", row.id)
    .where("tenant_id", "=", params.tenantId)
    .executeTakeFirst();

  if (alreadyRedeemed) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Este tenant ya usó este discount code.",
    });
  }

  if (row.kind === "amount_off") {
    if (!row.amount_type || typeof row.amount_value !== "number") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Discount code de monto está mal configurado.",
      });
    }

    const amount =
      row.amount_type === "percentage"
        ? (params.baseAmount * row.amount_value) / 100
        : row.amount_value;

    return {
      codeId: row.id,
      code: row.code,
      kind: row.kind,
      appliedAmount: Math.max(0, Number(amount)),
      unlockFeatureKeys: [],
      unlockDays: 0,
    };
  }

  const unlockFeatures = (row.feature_keys?.length
    ? row.feature_keys
    : params.selectedFeatureKeys) as FeatureKey[];
  const unlockDays = row.unlock_days ?? 30;

  return {
    codeId: row.id,
    code: row.code,
    kind: row.kind,
    appliedAmount: 0,
    unlockFeatureKeys: unlockFeatures,
    unlockDays,
  };
}

async function resolveFeatureAmount(params: {
  featureKeys: FeatureKey[];
}): Promise<{ amount: number; priceByKey: Map<FeatureKey, number> }> {
  const uniqueFeatureKeys = Array.from(new Set(params.featureKeys));
  const pricedFeatures = await getDb()
    .selectFrom("features")
    .select(["key", "monthly_price"])
    .where("key", "in", uniqueFeatureKeys)
    .execute();

  const priceByKey = new Map<FeatureKey, number>(
    pricedFeatures.map((feature) => [
      feature.key,
      Number(feature.monthly_price) || BILLING_FEATURE_PRICING_FALLBACK[feature.key],
    ]),
  );

  const amount = uniqueFeatureKeys.reduce(
    (sum, key) =>
      sum +
      (priceByKey.get(key) ?? BILLING_FEATURE_PRICING_FALLBACK[key] ?? 0),
    0,
  );

  return { amount, priceByKey };
}

function getActorUserId(session: Record<string, unknown> | null): string {
  const userId = session && typeof session.sub === "string" ? session.sub : "";
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return userId;
}

function getSanitizedDiscountPreviewMessage(error: TRPCError): string {
  if (error.code === "BAD_REQUEST") {
    return "Discount code inválido.";
  }

  return "Discount code inválido o no disponible para este tenant.";
}

async function assertMercadoPagoSyncFeature(params: {
  tenantId: string;
  userId: string;
}): Promise<void> {
  try {
    await featureGateService.assert({
      tenantId: params.tenantId,
      userId: params.userId,
      feature: "mercadopago_sync",
    });
  } catch {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tu plan no incluye sincronización con Mercado Pago.",
    });
  }
}

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
      await assertMercadoPagoSyncFeature({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

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
      await assertMercadoPagoSyncFeature({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

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
      await assertMercadoPagoSyncFeature({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

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
      await assertMercadoPagoSyncFeature({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

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
      await assertMercadoPagoSyncFeature({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

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
  previewDiscount: managerProcedure
    .input(
      z.object({
        featureKeys: z.array(featureKeySchema).min(1),
        discountCode: z.string().trim().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertGlobalDiscountPreviewRateLimit();

      const uniqueFeatureKeys = Array.from(new Set(input.featureKeys));
      const base = await resolveFeatureAmount({ featureKeys: uniqueFeatureKeys });
      const baseAmount = base.amount;

      if (!input.discountCode?.trim()) {
        return {
          valid: true,
          message: null,
          baseAmount,
          discountApplied: 0,
          finalAmount: baseAmount,
          kind: null,
          unlockFeatureKeys: [] as FeatureKey[],
          unlockDays: 0,
        };
      }

      try {
        const discount = await resolveDiscountCode({
          tenantId: ctx.tenantId,
          discountCode: input.discountCode,
          baseAmount,
          selectedFeatureKeys: uniqueFeatureKeys,
        });

        const finalAmount = Math.max(0, baseAmount - (discount.appliedAmount ?? 0));
        if (finalAmount <= 0) {
          return {
            valid: false,
            message: "El descuento deja el total en 0. Ajusta selección o código.",
            baseAmount,
            discountApplied: discount.appliedAmount,
            finalAmount,
            kind: discount.kind,
            unlockFeatureKeys: discount.unlockFeatureKeys,
            unlockDays: discount.unlockDays,
          };
        }

        return {
          valid: true,
          message: null,
          baseAmount,
          discountApplied: discount.appliedAmount,
          finalAmount,
          kind: discount.kind,
          unlockFeatureKeys: discount.unlockFeatureKeys,
          unlockDays: discount.unlockDays,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          console.warn("[billing.previewDiscount] discount validation rejected", {
            code: error.code,
            tenantId: ctx.tenantId,
          });

          return {
            valid: false,
            message: getSanitizedDiscountPreviewMessage(error),
            baseAmount,
            discountApplied: 0,
            finalAmount: baseAmount,
            kind: null,
            unlockFeatureKeys: [] as FeatureKey[],
            unlockDays: 0,
          };
        }

        throw error;
      }
    }),

  featureCatalog: managerProcedure.query(async ({ ctx }) => {
    const features = await getDb()
      .selectFrom("features")
      .leftJoin("feature_entitlements", (join) =>
        join
          .onRef("feature_entitlements.feature_id", "=", "features.id")
          .on("feature_entitlements.tenant_id", "=", ctx.tenantId),
      )
      .select([
        "features.key",
        "features.trial_days",
        "features.monthly_price",
        "feature_entitlements.granted_by_plan",
        "feature_entitlements.trial_ends_at",
      ])
      .orderBy("features.key", "asc")
      .execute();

    const entitlement = await getDb()
      .selectFrom("tenant_entitlements")
      .select("features_enabled")
      .where("tenant_id", "=", ctx.tenantId)
      .executeTakeFirst();

    const enabled = new Set(entitlement?.features_enabled ?? []);
    const now = Date.now();

    const rows = features.map((feature) => {
      const key = feature.key;
      const trialEndsAt = feature.trial_ends_at;
      const trialMs = trialEndsAt ? new Date(trialEndsAt).getTime() - now : null;
      const trialActive = typeof trialMs === "number" && trialMs > 0;
      const trialDaysRemaining = trialActive
        ? Math.ceil(trialMs / (1000 * 60 * 60 * 24))
        : 0;

      const activeByPlan =
        feature.granted_by_plan === true
        || enabled.has(key)
        || enabled.has("*")
        || enabled.has("all_paid_features");

      const status = activeByPlan
        ? "active"
        : trialActive
          ? "trial"
          : trialEndsAt
            ? "expired"
            : "inactive";

      return {
        key,
        label: BILLING_FEATURE_LABELS[key],
        monthlyPrice:
          Number(feature.monthly_price) || BILLING_FEATURE_PRICING_FALLBACK[key],
        trialDays: feature.trial_days,
        trialDaysRemaining,
        status,
      };
    });

    return {
      currencyId: "MXN",
      features: rows,
    };
  }),

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
        featureKeys: z.array(featureKeySchema).min(1),
        discountCode: z.string().trim().optional(),
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
          platformConfig.paymentAccessToken,
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
      const uniqueFeatureKeys = Array.from(new Set(input.featureKeys));
      const normalizedAmount = (await resolveFeatureAmount({
        featureKeys: uniqueFeatureKeys,
      })).amount;

      const discount = input.discountCode
        ? await resolveDiscountCode({
            tenantId: ctx.tenantId,
            discountCode: input.discountCode,
            baseAmount: normalizedAmount,
            selectedFeatureKeys: uniqueFeatureKeys,
          })
        : null;

      const finalAmount = Math.max(0, normalizedAmount - (discount?.appliedAmount ?? 0));

      if (finalAmount <= 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "El total final debe ser mayor a 0 para activar billing.",
        });
      }

      // ── Idempotency guard: skip remote creation if active sub exists ────
      const existingSub = await getDb()
        .selectFrom("tenant_subscriptions")
        .select([
          "id",
          "external_subscription_id",
          "status",
          "metadata",
        ])
        .where("tenant_id", "=", ctx.tenantId)
        .where("provider", "=", "mercadopago")
        .where("status", "not in", ["canceled", "expired"])
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst();

      if (existingSub) {
        console.info(
          `[billing.activate] Tenant ${ctx.tenantId} already has active subscription ${existingSub.external_subscription_id} (status=${existingSub.status}) — returning existing`,
        );
        const meta = (existingSub.metadata ?? {}) as Record<string, unknown>;
        return {
          ok: true as const,
          tenantId: ctx.tenantId,
          payerEmail,
          planId: (meta.plan_id as string) ?? null,
          subscriptionId: existingSub.external_subscription_id ?? "",
          status: existingSub.status,
          initPoint: (meta.checkout_url as string) ?? null,
          existing: true as const,
        };
      }

      const plan = await createPreapprovalPlan({
        accessToken: normalizedBillingAccessToken,
        reason: input.reason,
        transactionAmount: finalAmount,
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
            amount: finalAmount,
            amount_before_discount: normalizedAmount,
            currency_id: input.currencyId,
            feature_keys: uniqueFeatureKeys,
            discount_code: discount?.code ?? null,
            discount_kind: discount?.kind ?? null,
            discount_amount: discount?.appliedAmount ?? 0,
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
              amount: finalAmount,
              amount_before_discount: normalizedAmount,
              currency_id: input.currencyId,
              feature_keys: uniqueFeatureKeys,
              discount_code: discount?.code ?? null,
              discount_kind: discount?.kind ?? null,
              discount_amount: discount?.appliedAmount ?? 0,
            },
            updated_at: sql<Date>`CURRENT_TIMESTAMP`,
          }),
        )
        .execute();

      if (discount) {
        await getDb()
          .insertInto("discount_redemptions")
          .values({
            discount_code_id: discount.codeId,
            tenant_id: ctx.tenantId,
            subscription_id: subscription.id,
            kind: discount.kind,
            amount_applied: discount.appliedAmount || null,
            feature_keys: discount.unlockFeatureKeys.length > 0 ? discount.unlockFeatureKeys : null,
            unlock_starts_at:
              discount.kind === "feature_unlock" ? sql`now()` : null,
            unlock_ends_at:
              discount.kind === "feature_unlock"
                ? sql`now() + (${discount.unlockDays} * interval '1 day')`
                : null,
            metadata: {
              code: discount.code,
              unlockDays: discount.unlockDays,
            },
          })
          .execute();

        await getDb()
          .updateTable("discount_codes")
          .set({
            redeemed_count: sql`discount_codes.redeemed_count + 1`,
            updated_at: sql`now()`,
          })
          .where("id", "=", discount.codeId)
          .execute();

        if (discount.kind === "feature_unlock" && discount.unlockFeatureKeys.length > 0) {
          const unlockRows = await getDb()
            .selectFrom("features")
            .select(["id", "key"])
            .where("key", "in", discount.unlockFeatureKeys)
            .execute();

          for (const feature of unlockRows) {
            await getDb()
              .insertInto("feature_entitlements")
              .values({
                tenant_id: ctx.tenantId,
                feature_id: feature.id,
                trial_started_at: sql`now()`,
                trial_ends_at: sql`now() + (${discount.unlockDays} * interval '1 day')`,
                granted_by_plan: false,
              })
              .onConflict((oc) =>
                oc.columns(["tenant_id", "feature_id"]).doUpdateSet({
                  trial_ends_at: sql`GREATEST(COALESCE(feature_entitlements.trial_ends_at, now()), now() + (${discount.unlockDays} * interval '1 day'))`,
                  updated_at: sql`now()`,
                }),
              )
              .execute();
          }
        }
      }

      await getDb()
        .insertInto("tenant_entitlements")
        .values({
          tenant_id: ctx.tenantId,
          subscription_status: "active",
          features_enabled: uniqueFeatureKeys,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.column("tenant_id").doUpdateSet({
            subscription_status: "active",
            features_enabled: uniqueFeatureKeys,
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
        amount: finalAmount,
        amountBeforeDiscount: normalizedAmount,
        discountCode: discount?.code ?? null,
        discountApplied: discount?.appliedAmount ?? 0,
        featureKeys: uniqueFeatureKeys,
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
      await assertMercadoPagoSyncFeature({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

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
      await assertMercadoPagoSyncFeature({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

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
      await assertMercadoPagoSyncFeature({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

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
      await assertMercadoPagoSyncFeature({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

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
