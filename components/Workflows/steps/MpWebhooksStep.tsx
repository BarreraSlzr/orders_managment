"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardCopy, ExternalLink, Info } from "lucide-react";
import { useState } from "react";

interface MpWebhooksStepProps {
  data: Record<string, unknown>;
  onChange: (params: { data: Record<string, unknown> }) => void;
}

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
      <span className="flex-1 truncate">{url}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700 transition-colors"
        aria-label="Copy URL"
      >
        <ClipboardCopy className="h-3.5 w-3.5" />
      </button>
      {copied && (
        <span className="shrink-0 text-emerald-600 font-sans">Copied!</span>
      )}
    </div>
  );
}

export function MpWebhooksStep({ data, onChange }: MpWebhooksStepProps) {
  const webhookSecret = typeof data.MP_WEBHOOK_SECRET === "string" ? data.MP_WEBHOOK_SECRET : "";

  // Derives the base URL from the running browser tab — always accurate.
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  const webhookUrl = `${origin}/api/mercadopago/webhook`;
  const testWebhookUrl = `${origin}/api/mercadopago/webhook/test`;

  return (
    <div className="space-y-5">
      {/* Context: which MP app */}
      <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
        <strong>App de pagos presenciales (Point)</strong> — Este webhook recibe
        notificaciones de cobros, terminales y vinculación OAuth de tus tenants.
      </div>

      {/* Instruction card */}
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div className="space-y-2 text-sky-900">
            <p className="font-semibold">Configurar el webhook de pagos en MP</p>
            <ol className="list-decimal pl-4 space-y-0.5 text-sky-800">
              <li>
                En el menú lateral de tu app (bajo{" "}
                <strong>NOTIFICACIONES</strong>), haz clic en{" "}
                <a
                  href="https://www.mercadopago.com.mx/developers/panel/app/2318642168506769/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium underline decoration-sky-400"
                >
                  Webhooks
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Haz clic en el botón <strong>Configurar notificaciones</strong></li>
              <li>
                Selecciona la pestaña <strong>Modo productivo</strong> → pega la
                URL de producción en el campo{" "}
                <strong>URL de producción</strong>
              </li>
              <li>
                Cambia a la pestaña <strong>Modo de prueba</strong> → pega la URL
                de prueba en el campo <strong>URL para prueba</strong>
              </li>
              <li>
                Bajo <em>Eventos recomendados para integraciones con Point de
                Mercado Pago</em>, activa:
                <ul className="mt-0.5 list-disc pl-4 space-y-0.5">
                  <li><strong>Integraciones Point</strong> — eventos de terminal PDV</li>
                  <li><strong>Order (Mercado Pago)</strong> — API v1/orders</li>
                  <li><strong>Vinculación de aplicaciones</strong> — flujo OAuth</li>
                </ul>
              </li>
              <li>
                Haz clic en <strong>Guardar configuración</strong>
              </li>
              <li>
                Revela el campo <strong>Clave secreta</strong> (ícono de ojo) →
                cópialo y pégalo abajo
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Webhook URLs */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">
          URL de producción{" "}
          <span className="font-normal text-slate-400 text-xs">
            → campo <em>URL de producción</em> en pestaña Modo productivo
          </span>
        </p>
        <CopyableUrl url={webhookUrl} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">
          URL de prueba{" "}
          <span className="font-normal text-slate-400 text-xs">
            → campo <em>URL para prueba</em> en pestaña Modo de prueba
          </span>
        </p>
        <CopyableUrl url={testWebhookUrl} />
        <p className="text-xs text-slate-500 mt-1">
          Omite la validación de firma — solo para notificaciones de prueba de MP.
        </p>
      </div>

      {/* Webhook secret */}
      <div className="space-y-1">
        <Label htmlFor="mp-webhook-secret">
          Clave secreta{" "}
          <span className="font-mono text-xs text-slate-400">MP_WEBHOOK_SECRET</span>
        </Label>
        <Input
          id="mp-webhook-secret"
          type="password"
          value={webhookSecret}
          onChange={(e) => onChange({ data: { MP_WEBHOOK_SECRET: e.target.value } })}
          placeholder="••••••••••••••••••••••••••••••••"
          autoComplete="new-password"
          spellCheck={false}
        />
        <p className="text-xs text-slate-500">
          El valor del campo <strong>Clave secreta</strong> que muestra MP después de
          guardar la configuración de Webhooks. Déjalo vacío para omitir la
          validación HMAC (solo desarrollo local).
        </p>
      </div>
    </div>
  );
}
