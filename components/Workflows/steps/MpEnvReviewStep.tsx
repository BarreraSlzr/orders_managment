"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, ClipboardCopy, XCircle } from "lucide-react";
import { useState } from "react";

interface EnvStatus {
  MP_CLIENT_ID: boolean;
  MP_CLIENT_SECRET: boolean;
  MP_REDIRECT_URI: boolean;
  MP_WEBHOOK_SECRET: boolean;
  MP_BILLING_WEBHOOK_SECRET: boolean;
  MP_TOKENS_ENCRYPTION_KEY: boolean;
}

interface MpEnvReviewStepProps {
  data: Record<string, unknown>;
  envStatus?: EnvStatus | null;
  onChange: (params: { data: Record<string, unknown> }) => void;
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

export function MpEnvReviewStep({ data, envStatus, onChange }: MpEnvReviewStepProps) {
  const [copied, setCopied] = useState(false);
  const confirmed = data.confirmed === true;

  const clientId = typeof data.MP_CLIENT_ID === "string" ? data.MP_CLIENT_ID : "";
  const clientSecret = typeof data.MP_CLIENT_SECRET === "string" ? data.MP_CLIENT_SECRET : "";
  const webhookSecret = typeof data.MP_WEBHOOK_SECRET === "string" ? data.MP_WEBHOOK_SECRET : "";
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
    ...(billingSecret ? [`MP_BILLING_WEBHOOK_SECRET=${billingSecret}`] : []),
    ...(encryptionKey ? [`MP_TOKENS_ENCRYPTION_KEY=${encryptionKey}`] : []),
  ].join("\n");

  function handleCopy() {
    void navigator.clipboard.writeText(envLines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const rows: Array<{ key: keyof EnvStatus; label: string; value: string }> = [
    { key: "MP_CLIENT_ID", label: "Client ID", value: clientId },
    { key: "MP_CLIENT_SECRET", label: "Client Secret", value: mask(clientSecret) },
    { key: "MP_REDIRECT_URI", label: "Redirect URI", value: redirectUri },
    { key: "MP_WEBHOOK_SECRET", label: "Webhook Secret", value: mask(webhookSecret) },
    { key: "MP_BILLING_WEBHOOK_SECRET", label: "Billing Secret", value: billingSecret ? mask(billingSecret) : "—" },
    { key: "MP_TOKENS_ENCRYPTION_KEY", label: "Encryption Key", value: encryptionKey ? mask(encryptionKey) : "—" },
  ];

  return (
    <div className="space-y-5">
      {/* Summary table */}
      <div className="rounded-lg border bg-white text-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b">
          <p className="font-semibold text-slate-700">Resumen de variables</p>
          <p className="text-xs text-slate-500 mt-0.5">
            La columna <em>Servidor</em> muestra si la variable ya está activa en
            el despliegue actual.
          </p>
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

      {/* .env block with copy button */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            Bloque .env — pega en Vercel / panel de hosting
          </p>
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
        <p className="text-xs text-slate-500">
          En Vercel: Project → Settings → Environment Variables → pega o
          agrega cada clave de forma individual.
        </p>
      </div>

      {/* Confirm checkbox */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(checked) =>
            onChange({ data: { confirmed: Boolean(checked) } })
          }
        />
        He copiado las variables en la configuración de entorno de mi hosting.
      </label>
    </div>
  );
}
