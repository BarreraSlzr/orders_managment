"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Info } from "lucide-react";

interface MpOAuthStepProps {
  data: Record<string, unknown>;
  onChange: (params: { data: Record<string, unknown> }) => void;
}

export function MpOAuthStep({ data, onChange }: MpOAuthStepProps) {
  const clientId = typeof data.MP_CLIENT_ID === "string" ? data.MP_CLIENT_ID : "";
  const clientSecret = typeof data.MP_CLIENT_SECRET === "string" ? data.MP_CLIENT_SECRET : "";

  return (
    <div className="space-y-5">
      {/* Architecture overview */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-700">Arquitectura de dos aplicaciones</p>
        <p className="mt-1 text-slate-600">
          Esta plataforma usa <strong>dos aplicaciones de Mercado Pago</strong> independientes,
          cada una con sus propias credenciales y webhooks en el{" "}
          <a
            href="https://www.mercadopago.com.mx/developers/panel/app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-medium underline decoration-slate-400"
          >
            Panel de Desarrolladores
            <ExternalLink className="h-3 w-3" />
          </a>:
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">App 1 — Pagos presenciales</p>
            <p className="mt-1 text-xs text-amber-800">
              Integración Point para cobrar a los clientes del tenant.
              Webhook: <span className="font-mono">/api/mercadopago/webhook</span>
            </p>
            <p className="mt-1 text-[10px] text-amber-600">
              Al completar OAuth, se crean automáticamente una sucursal y punto de venta.
            </p>
          </div>
          <div className="rounded-md border border-violet-200 bg-violet-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">App 2 — Facturación</p>
            <p className="mt-1 text-xs text-violet-800">
              Suscripciones para cobrar a los tenants por el uso de la plataforma.
              Webhook: <span className="font-mono">/api/billing/mercadopago/webhook</span>
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          En este paso configuras las credenciales de la <strong>App de pagos presenciales</strong>.
          La app de facturación se configura en el paso &quot;Facturación y cifrado&quot;.
        </p>
      </div>

      {/* Instruction card */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="space-y-1 text-amber-900">
            <p className="font-semibold">Cómo obtener estas credenciales</p>
            <ol className="list-decimal pl-4 space-y-0.5 text-amber-800">
              <li>
                Abre el{" "}
                <a
                  href="https://www.mercadopago.com.mx/developers/panel/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium underline decoration-amber-400"
                >
                  Panel de Desarrolladores de MP
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Haz clic en tu aplicación de <strong>pagos presenciales / Point</strong></li>
              <li>
                En el menú lateral izquierdo, bajo{" "}
                <strong>PRODUCCIÓN</strong>, haz clic en{" "}
                <strong>Credenciales de producción</strong>
              </li>
              <li>
                Desplázate hasta las tarjetas de <strong>Client ID</strong> y{" "}
                <strong>Client Secret</strong>{" "}
                (debajo de Public Key y Access Token)
              </li>
              <li>
                Haz clic en el ícono de copiar junto a cada valor y pégalos
                abajo
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Client ID */}
      <div className="space-y-1">
        <Label htmlFor="mp-client-id">
          Client ID{" "}
          <span className="font-mono text-xs text-slate-400">MP_CLIENT_ID</span>
        </Label>
        <Input
          id="mp-client-id"
          value={clientId}
          onChange={(e) => onChange({ data: { MP_CLIENT_ID: e.target.value } })}
          placeholder="1234567890"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-slate-500">
          El mismo número que aparece como <strong>Número de aplicación</strong> en tu
          panel de MP (p.ej. <span className="font-mono">2318642168506769</span>).
        </p>
      </div>

      {/* Client Secret */}
      <div className="space-y-1">
        <Label htmlFor="mp-client-secret">
          Client Secret{" "}
          <span className="font-mono text-xs text-slate-400">MP_CLIENT_SECRET</span>
        </Label>
        <Input
          id="mp-client-secret"
          type="password"
          value={clientSecret}
          onChange={(e) => onChange({ data: { MP_CLIENT_SECRET: e.target.value } })}
          placeholder="••••••••••••••••••••••••••••••••"
          autoComplete="new-password"
          spellCheck={false}
        />
        <p className="text-xs text-slate-500">
          Keep this secret — it authenticates your app with MercadoPago.
        </p>
      </div>
    </div>
  );
}
