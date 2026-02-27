"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, CheckCircle2, ClipboardCopy, Database, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";

interface EnvStatus {
  MP_CLIENT_ID: boolean;
  MP_CLIENT_SECRET: boolean;
  MP_REDIRECT_URI: boolean;
  MP_WEBHOOK_SECRET: boolean;
  MP_ACCESS_TOKEN: boolean;
  MP_BILLING_ACCESS_TOKEN: boolean;
  MP_BILLING_WEBHOOK_SECRET: boolean;
  MP_TOKENS_ENCRYPTION_KEY: boolean;
}

interface MpEnvReviewStepProps {
  data: Record<string, unknown>;
  envStatus?: EnvStatus | null;
  isError?: boolean;
  onRetry?: () => void;
  onChange: (params: { data: Record<string, unknown> }) => void;
  /** Called when the admin clicks "Guardar en la plataforma". Throws on error. */
  onSaveToDb?: () => Promise<void>;
  isSaving?: boolean;
}

function StatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />
      Configurado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      <XCircle className="h-3 w-3" />
      Sin configurar
    </span>
  );
}

/** Masks a secret: shows first 4 chars + placeholder dots. */
function mask(val: string): string {
  if (!val) return "";
  return val.slice(0, 4) + "•".repeat(Math.min(val.length - 4, 20));
}

export function MpEnvReviewStep({ data, envStatus, isError = false, onRetry, onChange, onSaveToDb, isSaving = false }: MpEnvReviewStepProps) {
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const confirmed = data.confirmed === true;

  const clientId = typeof data.MP_CLIENT_ID === "string" ? data.MP_CLIENT_ID : "";
  const clientSecret = typeof data.MP_CLIENT_SECRET === "string" ? data.MP_CLIENT_SECRET : "";
  const webhookSecret = typeof data.MP_WEBHOOK_SECRET === "string" ? data.MP_WEBHOOK_SECRET : "";
  const paymentAccessToken = typeof data.MP_ACCESS_TOKEN === "string" ? data.MP_ACCESS_TOKEN : "";
  const billingAccessToken = typeof data.MP_BILLING_ACCESS_TOKEN === "string" ? data.MP_BILLING_ACCESS_TOKEN : "";
  const billingSecret = typeof data.MP_BILLING_WEBHOOK_SECRET === "string" ? data.MP_BILLING_WEBHOOK_SECRET : "";
  const encryptionKey = typeof data.MP_TOKENS_ENCRYPTION_KEY === "string" ? data.MP_TOKENS_ENCRYPTION_KEY : "";

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  const redirectUri = `${origin}/api/mercadopago/webhook`;

  const envLines = [
    `# ─── Mercado Pago ────────────────────────────────────────────────────────────`,
    `MP_CLIENT_ID=${clientId}`,
    `MP_CLIENT_SECRET=${clientSecret}`,
    `MP_REDIRECT_URI=${redirectUri}`,
    `MP_WEBHOOK_SECRET=${webhookSecret}`,
    ...(paymentAccessToken ? [`MP_ACCESS_TOKEN=${paymentAccessToken}`] : []),
    ...(billingAccessToken ? [`MP_BILLING_ACCESS_TOKEN=${billingAccessToken}`] : []),
    ...(billingSecret ? [`MP_BILLING_WEBHOOK_SECRET=${billingSecret}`] : []),
    ...(encryptionKey ? [`MP_TOKENS_ENCRYPTION_KEY=${encryptionKey}`] : []),
  ].join("\n");

  function handleCopy() {
    void navigator.clipboard.writeText(envLines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleSaveToDb() {
    if (!onSaveToDb) return;
    setSaveError(null);
    try {
      await onSaveToDb();
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  const rows: Array<{ key: keyof EnvStatus; label: string; value: string }> = [
    { key: "MP_CLIENT_ID", label: "Client ID", value: clientId },
    { key: "MP_CLIENT_SECRET", label: "Client Secret", value: mask(clientSecret) },
    { key: "MP_REDIRECT_URI", label: "Redirect URI", value: redirectUri },
    { key: "MP_WEBHOOK_SECRET", label: "Webhook Secret", value: mask(webhookSecret) },
    { key: "MP_ACCESS_TOKEN", label: "Payment Access Token", value: paymentAccessToken ? mask(paymentAccessToken) : "—" },
    { key: "MP_BILLING_ACCESS_TOKEN", label: "Billing Access Token", value: billingAccessToken ? mask(billingAccessToken) : "—" },
    { key: "MP_BILLING_WEBHOOK_SECRET", label: "Billing Secret", value: billingSecret ? mask(billingSecret) : "—" },
    { key: "MP_TOKENS_ENCRYPTION_KEY", label: "Encryption Key", value: encryptionKey ? mask(encryptionKey) : "—" },
  ];

  return (
    <div className="space-y-5">
      {/* Wiring diagram */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <p className="font-semibold text-sm text-slate-700 mb-2">Resumen de integración</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1 text-left font-medium text-slate-500">Concepto</th>
              <th className="py-1 text-left font-medium text-slate-500">App Pagos (Point)</th>
              <th className="py-1 text-left font-medium text-slate-500">App Facturación</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="py-1">Propósito</td>
              <td className="py-1">Cobrar a clientes del tenant</td>
              <td className="py-1">Cobrar al tenant por la plataforma</td>
            </tr>
            <tr>
              <td className="py-1">Credencial</td>
              <td className="py-1 font-mono">MP_CLIENT_ID / SECRET</td>
              <td className="py-1 font-mono">MP_BILLING_*</td>
            </tr>
            <tr>
              <td className="py-1">Webhook</td>
              <td className="py-1 font-mono">/api/mercadopago/webhook</td>
              <td className="py-1 font-mono">/api/billing/mercadopago/webhook</td>
            </tr>
            <tr>
              <td className="py-1">Eventos</td>
              <td className="py-1">Point, Order, OAuth</td>
              <td className="py-1">Suscripciones, Pagos</td>
            </tr>
            <tr>
              <td className="py-1">Auto-provisión</td>
              <td className="py-1">Sucursal + POS al conectar OAuth</td>
              <td className="py-1">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary table */}
      <div className="rounded-lg border bg-white text-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b">
          <p className="font-semibold text-slate-700">Resumen de variables</p>
          <p className="text-xs text-slate-500 mt-0.5">
            La columna <em>Servidor</em> muestra si la variable ya está activa en
            el despliegue actual.
          </p>
          {isError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>No se pudo verificar el estado del servidor.</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  Reintentar
                </button>
              )}
            </div>
          )}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-slate-50/60">
              <th className="px-4 py-2 text-left font-medium text-slate-500">Variable</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Valor</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Servidor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b last:border-0">
                <td className="px-4 py-2 font-mono text-slate-700">{row.key}</td>
                <td className="px-4 py-2 font-mono text-slate-500 max-w-[160px] truncate">
                  {row.value || <span className="text-slate-300">no provisto</span>}
                </td>
                <td className="px-4 py-2">
                  {envStatus ? (
                    <StatusBadge configured={envStatus[row.key]} />
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save to DB / .env actions */}
      <div className="space-y-3">
        {onSaveToDb && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Guardar en la plataforma</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Persiste la configuración directamente en la base de datos. No se
                requieren variables de entorno adicionales.
              </p>
            </div>

            {saveSuccess ? (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Configuración guardada correctamente.
              </div>
            ) : (
              <>
                {saveError && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {saveError}
                  </div>
                )}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSaveToDb()}
                  className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {isSaving ? "Guardando…" : "Guardar en la plataforma"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Fallback copy block */}
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
            <span>Copia manual (.env)</span>
            <span className="text-slate-400 group-open:hidden">▼</span>
            <span className="text-slate-400 hidden group-open:inline">▲</span>
          </summary>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg border bg-slate-950 p-4 font-mono text-xs text-slate-100 leading-relaxed select-all">
              {envLines}
            </pre>
          </div>
        </details>
      </div>

      {/* Confirm checkbox */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={confirmed || saveSuccess}
          onCheckedChange={(checked) =>
            onChange({ data: { confirmed: Boolean(checked) } })
          }
        />
        Configuración aplicada en la plataforma.
      </label>
    </div>
  );
}
