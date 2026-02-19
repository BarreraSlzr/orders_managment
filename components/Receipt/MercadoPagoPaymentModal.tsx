"use client";

/**
 * MercadoPagoPaymentModal
 *
 * Mercado Pago–branded modal that shows payment status and polls for
 * confirmation. Supports QR and PDV (Point terminal) flows.
 * On Android devices with a PDV flow, shows a deep-link button to
 * open the Mercado Pago Point app directly.
 */
import { SyncAttempt } from "@/lib/services/mercadopago/statusService";
import { useTRPC } from "@/lib/trpc/react";
import { MpSyncResult } from "@/lib/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Smartphone,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef } from "react";

// ─── Mercado Pago brand tokens ────────────────────────────────────────────────
const MP_BLUE = "#009EE3";
const MP_BLUE_DARK = "#0077b6";
const MP_GREEN = "#00A650";
const MP_RED = "#F23D4F";
const MP_ORANGE = "#FF7733";
const MP_GRAY = "#6B7280";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MercadoPagoPaymentModalProps {
  result: MpSyncResult;
  orderId: string;
  onClose: () => void;
  onRetry: () => void;
}

// ─── Label / colour maps ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<MpSyncResult["status"], string> = {
  pending: "Esperando pago…",
  processing: "Procesando en terminal…",
  approved: "¡Pago aprobado!",
  rejected: "Pago rechazado",
  canceled: "Pago cancelado",
  error: "Error al procesar pago",
};

const STATUS_BG: Record<MpSyncResult["status"], string> = {
  pending: "#FFF7ED",
  processing: "#EFF9FF",
  approved: "#F0FDF4",
  rejected: "#FFF1F2",
  canceled: "#F9FAFB",
  error: "#FFF1F2",
};

const STATUS_COLOR: Record<MpSyncResult["status"], string> = {
  pending: MP_ORANGE,
  processing: MP_BLUE,
  approved: MP_GREEN,
  rejected: MP_RED,
  canceled: MP_GRAY,
  error: MP_RED,
};

const TERMINAL_STATUSES = new Set([
  "approved",
  "rejected",
  "canceled",
  "error",
]);
const POLL_INTERVAL_MS = 5_000;

// ─── MP Wordmark SVG ──────────────────────────────────────────────────────────

function MpWordmark() {
  return (
    <svg
      viewBox="0 0 120 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Mercado Pago"
      className="h-5"
    >
      <text
        x="0"
        y="22"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="20"
        fill="white"
        letterSpacing="-0.5"
      >
        mercadopago
      </text>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MercadoPagoPaymentModal({
  result,
  orderId,
  onClose,
  onRetry,
}: MercadoPagoPaymentModalProps) {
  const trpc = useTRPC();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect Android for Point Tap deep link
  const isAndroid =
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  // Poll attempt status
  const attemptQuery = useQuery({
    ...trpc.mercadopago.payment.attempt.queryOptions({
      attemptId: result.attemptId,
    }),
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)
        ?.status;
      return status && TERMINAL_STATUSES.has(status) ? false : POLL_INTERVAL_MS;
    },
    staleTime: 0,
  });

  // Cancel mutation — called before retry to reset idempotency guard
  const cancelMutation = useMutation(
    trpc.mercadopago.payment.cancel.mutationOptions(),
  );

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const attempt = attemptQuery.data as SyncAttempt | undefined;
  const status = (attempt?.status ?? result.status) as MpSyncResult["status"];
  const qrCode = attempt?.qr_code ?? result.qrCode;
  const terminalId = attempt?.terminal_id ?? result.terminalId;
  const mpTransactionId = attempt?.mp_transaction_id ?? result.mpTransactionId;
  const isTerminal = TERMINAL_STATUSES.has(status);

  // Android Point Tap deep link
  // Opens the MP Point app directly on the payment screen
  const androidDeepLink = `intent://point/payment#Intent;scheme=mercadopago;package=com.mercadopago.android.px;end`;

  async function handleRetry() {
    try {
      await cancelMutation.mutateAsync({ orderId });
    } catch {
      // ignore cancel errors — proceed with retry anyway
    }
    onRetry();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "#FFFFFF",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* ── MP Header ───────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: MP_BLUE }}
        >
          <MpWordmark />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1 transition-colors"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 px-5 py-5">
          {/* Status pill */}
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              background: STATUS_BG[status],
              color: STATUS_COLOR[status],
            }}
          >
            <StatusIcon status={status} />
            <span>{STATUS_LABELS[status]}</span>
            {!isTerminal && (
              <RefreshCw
                className="h-3 w-3 animate-spin ml-auto opacity-60"
                style={{ color: STATUS_COLOR[status] }}
              />
            )}
          </div>

          {/* ── QR Code display ──────────────────────────────────────────── */}
          {qrCode && !isTerminal && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="rounded-xl p-3"
                style={{
                  border: `3px solid ${MP_BLUE}`,
                  background: "#F8FBFF",
                }}
              >
                {qrCode.startsWith("http") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrCode}
                    alt="QR de pago"
                    className="w-44 h-44 block"
                  />
                ) : (
                  <div
                    className="w-44 h-44 flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: qrCode }}
                  />
                )}
              </div>
              <p className="text-xs text-center" style={{ color: MP_GRAY }}>
                Escanea con la app de{" "}
                <span style={{ color: MP_BLUE, fontWeight: 600 }}>
                  Mercado Pago
                </span>
              </p>
            </div>
          )}

          {/* ── Approved full-width banner ───────────────────────────────── */}
          {status === "approved" && (
            <div
              className="flex flex-col items-center gap-1 rounded-xl py-4"
              style={{ background: "#F0FDF4" }}
            >
              <CheckCircle className="h-10 w-10" style={{ color: MP_GREEN }} />
              <p className="font-bold text-base" style={{ color: MP_GREEN }}>
                ¡Listo! Pago confirmado
              </p>
            </div>
          )}

          {/* ── PDV terminal info ─────────────────────────────────────────── */}
          {terminalId && !qrCode && status !== "approved" && (
            <div
              className="flex items-start gap-3 rounded-xl p-4"
              style={{ background: "#EFF9FF" }}
            >
              <Smartphone
                className="h-5 w-5 mt-0.5 shrink-0"
                style={{ color: MP_BLUE }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold text-sm"
                  style={{ color: MP_BLUE_DARK }}
                >
                  Terminal Point
                </p>
                <p
                  className="text-xs font-mono truncate mt-0.5"
                  style={{ color: MP_BLUE }}
                >
                  {terminalId}
                </p>
                <p className="text-xs mt-1" style={{ color: MP_GRAY }}>
                  La solicitud fue enviada. Acepta el cobro en la terminal.
                </p>
              </div>
            </div>
          )}

          {/* ── Android Point Tap deep-link ───────────────────────────────── */}
          {isAndroid && terminalId && !isTerminal && (
            <a
              href={androidDeepLink}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-opacity active:opacity-70"
              style={{
                background: MP_BLUE,
                color: "#FFFFFF",
                textDecoration: "none",
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir en Mercado Pago Point
            </a>
          )}

          {/* ── Transaction ref ───────────────────────────────────────────── */}
          {mpTransactionId && (
            <p
              className="text-xs font-mono truncate text-center"
              style={{ color: MP_GRAY }}
            >
              Ref: {mpTransactionId}
            </p>
          )}

          {/* ── Polling hint ──────────────────────────────────────────────── */}
          {!isTerminal && (
            <p className="text-xs text-center" style={{ color: MP_GRAY }}>
              Actualizando cada {POLL_INTERVAL_MS / 1000} s…
            </p>
          )}

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-1">
            {isTerminal && (status === "rejected" || status === "error") && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={cancelMutation.isPending}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                style={{ background: MP_BLUE, color: "#FFFFFF" }}
              >
                {cancelMutation.isPending ? "Cancelando…" : "Reintentar"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold border transition-colors"
              style={{
                borderColor:
                  isTerminal && status === "approved" ? MP_GREEN : "#D1D5DB",
                color: isTerminal && status === "approved" ? MP_GREEN : MP_GRAY,
                background: "#FFFFFF",
              }}
            >
              {isTerminal && status === "approved" ? "¡Listo!" : "Cancelar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status icon helper ───────────────────────────────────────────────────────

function StatusIcon({ status }: { status: MpSyncResult["status"] }) {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 shrink-0" />;
    case "processing":
      return <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />;
    case "approved":
      return <CheckCircle className="h-4 w-4 shrink-0" />;
    case "rejected":
    case "canceled":
      return <XCircle className="h-4 w-4 shrink-0" />;
    case "error":
      return <AlertCircle className="h-4 w-4 shrink-0" />;
  }
}
