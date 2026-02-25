"use client";

/**
 * EntitlementBanner — displays a contextual warning when the tenant's
 * MercadoPago subscription is in a degraded state (past_due, grace_period,
 * canceled, expired, or none).
 *
 * Usage:
 *   <EntitlementBanner
 *     subscriptionStatus={creds.subscriptionStatus}
 *     gracePeriodEnd={creds.gracePeriodEnd}
 *   />
 *
 * The component renders nothing when `subscriptionStatus` is null, "active",
 * or when `ENTITLEMENT_ENABLED` is not yet wired (backend returns null).
 *
 * See docs/MERCADOPAGO_ENTITLEMENT_ARCHITECTURE.md for the full design.
 */

import type { TenantSubscriptionStatus } from "@/lib/sql/types";

export interface EntitlementBannerProps {
  subscriptionStatus: TenantSubscriptionStatus | null | undefined;
  gracePeriodEnd?: Date | string | null;
}

interface BannerConfig {
  variant: "warning" | "error" | "info";
  title: string;
  message: string;
}

function getBannerConfig(
  status: TenantSubscriptionStatus,
  gracePeriodEnd?: Date | string | null,
): BannerConfig | null {
  switch (status) {
    case "past_due":
      return {
        variant: "warning",
        title: "Pago pendiente",
        message:
          "Tu suscripción tiene un pago pendiente. Regularízala para seguir usando los pagos con Mercado Pago.",
      };

    case "grace_period": {
      const endDate = gracePeriodEnd ? new Date(gracePeriodEnd) : null;
      const formatted = endDate
        ? endDate.toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : null;
      return {
        variant: "warning",
        title: "Período de gracia",
        message: formatted
          ? `Tu período de gracia vence el ${formatted}. Actualiza tu método de pago para evitar interrupciones.`
          : "Tu período de gracia está activo. Actualiza tu método de pago para evitar interrupciones.",
      };
    }

    case "canceled":
    case "expired":
      return {
        variant: "error",
        title: "Suscripción cancelada",
        message:
          "Tu suscripción fue cancelada. Renuévala para volver a habilitar los pagos con Mercado Pago.",
      };

    case "none":
      return {
        variant: "info",
        title: "Sin suscripción",
        message:
          "Necesitas una suscripción activa para conectar Mercado Pago.",
      };

    case "active":
    default:
      return null;
  }
}

const variantClasses: Record<BannerConfig["variant"], string> = {
  warning:
    "bg-yellow-50 border-yellow-400 text-yellow-900",
  error:
    "bg-red-50 border-red-400 text-red-900",
  info:
    "bg-blue-50 border-blue-400 text-blue-900",
};

const iconClasses: Record<BannerConfig["variant"], string> = {
  warning: "text-yellow-500",
  error: "text-red-500",
  info: "text-blue-500",
};

function BannerIcon({ variant }: { variant: BannerConfig["variant"] }) {
  const cls = `h-5 w-5 shrink-0 ${iconClasses[variant]}`;
  if (variant === "error") {
    return (
      <svg className={cls} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0V8.75a.75.75 0 00-1.5 0v4.5zm.75-7a.75.75 0 100-1.5.75.75 0 000 1.5z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Renders a banner when the tenant subscription is in a degraded state.
 * Returns null for active subscriptions and when billing is not enabled.
 */
export function EntitlementBanner({
  subscriptionStatus,
  gracePeriodEnd,
}: EntitlementBannerProps) {
  if (!subscriptionStatus) return null;

  const config = getBannerConfig(subscriptionStatus, gracePeriodEnd);
  if (!config) return null;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${variantClasses[config.variant]}`}
    >
      <BannerIcon variant={config.variant} />
      <div>
        <p className="font-semibold">{config.title}</p>
        <p className="mt-0.5">{config.message}</p>
      </div>
    </div>
  );
}
