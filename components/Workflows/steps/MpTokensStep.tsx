"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Info, RefreshCw } from "lucide-react";

interface MpTokensStepProps {
  data: Record<string, unknown>;
  onChange: (params: { data: Record<string, unknown> }) => void;
}

/** Generates a 64-char random hex string using the Web Crypto API. */
function generateEncryptionKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function MpTokensStep({ data, onChange }: MpTokensStepProps) {
  const billingSecret =
    typeof data.MP_BILLING_WEBHOOK_SECRET === "string"
      ? data.MP_BILLING_WEBHOOK_SECRET
      : "";
  const encryptionKey =
    typeof data.MP_TOKENS_ENCRYPTION_KEY === "string"
      ? data.MP_TOKENS_ENCRYPTION_KEY
      : "";

  function handleGenerateKey() {
    onChange({ data: { MP_TOKENS_ENCRYPTION_KEY: generateEncryptionKey() } });
  }

  return (
    <div className="space-y-5">
      {/* Billing webhook instruction */}
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
          <div className="space-y-2 text-violet-900">
            <p className="font-semibold">Webhook de facturación (suscripciones de plataforma)</p>
            <p className="text-violet-800">
              Este secreto es <em>distinto</em> al secreto de webhooks de pago.
              Protege los eventos del ciclo de vida de suscripciones (renovaciones,
              cancelaciones) que vienen de la <strong>app de facturación</strong>{" "}
              (una aplicación MP separada de tu integración de pagos).
            </p>
            <ol className="list-decimal pl-4 space-y-0.5 text-violet-800">
              <li>
                Abre el{" "}
                <a
                  href="https://www.mercadopago.com.mx/developers/panel/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium underline decoration-violet-400"
                >
                  Panel de Desarrolladores de MP
                  <ExternalLink className="h-3 w-3" />
                </a>
                {" "}→ selecciona tu <strong>app de facturación /
                suscripciones</strong> (diferente a la app de Point)
              </li>
              <li>
                En el menú lateral bajo <strong>NOTIFICACIONES</strong> →{" "}
                <strong>Webhooks</strong> → <strong>Configurar
                notificaciones</strong>
              </li>
              <li>
                Pestaña <strong>Modo productivo</strong>: pega la URL{" "}
                <span className="font-mono text-xs break-all">
                  {typeof window !== "undefined"
                    ? window.location.origin
                    : "https://tu-dominio.com"}
                  /api/billing/mercadopago/webhook
                </span>
              </li>
              <li>
                Activa el evento <strong>Planes y suscripciones</strong>
              </li>
              <li>
                Haz clic en <strong>Guardar configuración</strong> y copia la{" "}
                <strong>Clave secreta</strong>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Billing webhook secret */}
      <div className="space-y-1">
        <Label htmlFor="mp-billing-secret">
          Clave secreta de facturación{" "}
          <span className="font-mono text-xs text-slate-400">MP_BILLING_WEBHOOK_SECRET</span>
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            opcional
          </span>
        </Label>
        <Input
          id="mp-billing-secret"
          type="password"
          value={billingSecret}
          onChange={(e) =>
            onChange({ data: { MP_BILLING_WEBHOOK_SECRET: e.target.value } })
          }
          placeholder="••••••••••••••••••••••••••••••••"
          autoComplete="new-password"
          spellCheck={false}
        />
        <p className="text-xs text-slate-500">
          Déjalo vacío para omitir la validación HMAC en eventos de
          facturación (solo desarrollo local).
        </p>
      </div>

      {/* Token encryption key */}
      <div className="space-y-1">
        <Label htmlFor="mp-encryption-key">
          Clave de cifrado de tokens{" "}
          <span className="font-mono text-xs text-slate-400">MP_TOKENS_ENCRYPTION_KEY</span>
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            recomendado en producción
          </span>
        </Label>
        <div className="flex gap-2">
          <Input
            id="mp-encryption-key"
            type="password"
            value={encryptionKey}
            onChange={(e) =>
              onChange({ data: { MP_TOKENS_ENCRYPTION_KEY: e.target.value } })
            }
            placeholder="64-character hex string"
            autoComplete="new-password"
            spellCheck={false}
            className="flex-1 font-mono text-xs"
          />
          <button
            type="button"
            onClick={handleGenerateKey}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Generar
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Cifra los tokens de acceso/actualización de MP en la base de datos.
          Si está vacío, se usa <span className="font-mono">AUTH_SECRET</span>{" "}
          como respaldo. Haz clic en <strong>Generar</strong> para crear una
          clave aleatoria criptográficamente segura.
        </p>
      </div>
    </div>
  );
}
