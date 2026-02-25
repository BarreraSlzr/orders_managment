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
              <li>Haz clic en tu aplicación (p.ej. <strong>Orders Management MP-Point</strong>)</li>
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
