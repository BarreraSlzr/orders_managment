"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MpBillingActivationStepProps {
  data: Record<string, unknown>;
  tenantName?: string | null;
  linkedEmail?: string | null;
  onChange: (params: { data: Record<string, unknown> }) => void;
}

export function MpBillingActivationStep({
  data,
  tenantName,
  linkedEmail,
  onChange,
}: MpBillingActivationStepProps) {
  const reason = typeof data.reason === "string" ? data.reason : "Orders Management — Plan Mensual";
  const amount = typeof data.transactionAmount === "number" ? String(data.transactionAmount) : "299";
  const currencyId = typeof data.currencyId === "string" ? data.currencyId : "MXN";

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-4 py-3 text-xs text-violet-800">
        La suscripción se crea usando el <strong>Billing Access Token de plataforma</strong>.
        Este token ya no se solicita al tenant en este flujo.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Tenant (sesión actual)</Label>
          <Input value={tenantName ?? "—"} disabled />
        </div>
        <div className="space-y-1">
          <Label>Email OAuth vinculado</Label>
          <Input
            value={linkedEmail ?? "No vinculado en Settings"}
            disabled
            className={!linkedEmail ? "border-amber-300 text-amber-700" : undefined}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="billing-reason">Plan reason</Label>
          <Input
            id="billing-reason"
            value={reason}
            onChange={(e) => onChange({ data: { reason: e.target.value } })}
            placeholder="Orders Management — Plan Mensual"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="billing-amount">Monto</Label>
          <Input
            id="billing-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => onChange({ data: { transactionAmount: Number(e.target.value || 0) } })}
            placeholder="299"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="billing-currency">Currency ID</Label>
        <Input
          id="billing-currency"
          value={currencyId}
          onChange={(e) => onChange({ data: { currencyId: e.target.value.toUpperCase() } })}
          placeholder="MXN"
        />
      </div>
    </div>
  );
}