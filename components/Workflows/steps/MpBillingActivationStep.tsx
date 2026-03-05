"use client";

import { ReceiptFooter } from "@/components/Receipt/ReceiptFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/lib/trpc/react";
import { formatPrice } from "@/lib/utils/formatPrice";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

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
  const trpc = useTRPC();
  const catalogQuery = useQuery(trpc.mercadopago.billing.featureCatalog.queryOptions());
  const reason = typeof data.reason === "string" ? data.reason : "Orders Management — Plan Mensual";
  const discountCode = typeof data.discountCode === "string" ? data.discountCode : "";
  const selectedFeatureKeys = Array.isArray(data.featureKeys)
    ? (data.featureKeys as string[])
    : [];
  const catalog = catalogQuery.data;
  const currencyId = typeof data.currencyId === "string"
    ? data.currencyId
    : (catalog?.currencyId ?? "MXN");

  const total = useMemo(() => {
    if (!catalog) return 0;
    const selected = new Set(selectedFeatureKeys);
    return catalog.features.reduce((sum, row) => {
      if (!selected.has(row.key)) return sum;
      return sum + row.monthlyPrice;
    }, 0);
  }, [catalog, selectedFeatureKeys]);

  const previewQuery = useQuery({
    ...trpc.mercadopago.billing.previewDiscount.queryOptions({
      featureKeys: selectedFeatureKeys as Array<
        | "sales_history_extended"
        | "mercadopago_sync"
        | "multi_manager_users"
        | "payment_method_advanced"
        | "quick_add_product"
        | "order_expenses"
        | "product_composition"
      >,
      discountCode: discountCode.trim() ? discountCode.trim() : undefined,
    }),
    enabled: selectedFeatureKeys.length > 0,
  });

  const finalTotal = previewQuery.data?.finalAmount ?? total;
  const discountApplied = previewQuery.data?.discountApplied ?? 0;

  useEffect(() => {
    if (!catalog) return;

    const selected = selectedFeatureKeys.filter((key) =>
      catalog.features.some((feature) => feature.key === key),
    );

    const nextSelected = selected.length > 0
      ? selected
      : (() => {
          const defaults = catalog.features
            .filter((feature) => feature.status === "active" || feature.status === "trial")
            .map((feature) => feature.key);

          if (defaults.length > 0) return defaults;

          const mpFeature = catalog.features.find((feature) => feature.key === "mercadopago_sync");
          return mpFeature ? [mpFeature.key] : [];
        })();

    const nextTotal = catalog.features.reduce((sum, feature) => {
      return nextSelected.includes(feature.key) ? sum + feature.monthlyPrice : sum;
    }, 0);

    const currentAmount = typeof data.transactionAmount === "number" ? data.transactionAmount : 0;
    const shouldUpdateSelection = nextSelected.join("|") !== selectedFeatureKeys.join("|");
    const shouldUpdateAmount = currentAmount !== nextTotal;
    const shouldUpdateCurrency = currencyId !== catalog.currencyId;

    if (shouldUpdateSelection || shouldUpdateAmount || shouldUpdateCurrency) {
      onChange({
        data: {
          featureKeys: nextSelected,
          transactionAmount: nextTotal,
          currencyId: catalog.currencyId,
        },
      });
    }
  }, [catalog, currencyId, data.transactionAmount, onChange, selectedFeatureKeys]);

  const toggleFeature = (featureKey: string, checked: boolean) => {
    if (!catalog) return;

    const current = new Set(selectedFeatureKeys);
    if (checked) {
      current.add(featureKey);
    } else {
      current.delete(featureKey);
    }

    const nextSelected = Array.from(current);
    const nextTotal = catalog.features.reduce((sum, feature) => {
      return current.has(feature.key) ? sum + feature.monthlyPrice : sum;
    }, 0);

    onChange({
      data: {
        featureKeys: nextSelected,
        transactionAmount: nextTotal,
        currencyId: catalog.currencyId,
      },
    });
  };

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
          <Label htmlFor="billing-currency">Currency ID</Label>
          <Input
            id="billing-currency"
            value={currencyId}
            onChange={(e) => onChange({ data: { currencyId: e.target.value.toUpperCase() } })}
            placeholder="MXN"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="billing-discount">Discount code (opcional)</Label>
        <Input
          id="billing-discount"
          value={discountCode}
          onChange={(e) =>
            onChange({ data: { discountCode: e.target.value.toUpperCase() } })
          }
          placeholder="EJ: WELCOME10"
        />
      </div>

      <Card className="font-mono">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Plan mensual por funcionalidades</CardTitle>
          <p className="text-xs text-slate-500">
            Selecciona lo que quieres pagar este mes. El total se calcula con lo marcado.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {discountCode.trim() && previewQuery.isLoading && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Validando discount code...
            </div>
          )}
          {discountCode.trim() && previewQuery.isError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              No se pudo validar el discount code por límite de uso. Intenta en unos segundos.
            </div>
          )}
          {discountCode.trim() && previewQuery.data?.valid === false && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {previewQuery.data.message}
            </div>
          )}
          {discountCode.trim() && previewQuery.data?.valid === true && discountApplied > 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Descuento aplicado: -{formatPrice(discountApplied)}
            </div>
          )}
          {discountCode.trim() && previewQuery.data?.valid === true && previewQuery.data?.kind === "feature_unlock" && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Feature unlock por {previewQuery.data.unlockDays} días ({previewQuery.data.unlockFeatureKeys.join(", ") || "selección actual"}).
            </div>
          )}

          {catalogQuery.isLoading ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-slate-500">
              Cargando funcionalidades...
            </div>
          ) : catalogQuery.isError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              No se pudo cargar el catálogo de funcionalidades.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Pagar</th>
                    <th className="px-3 py-2 text-left">Funcionalidad</th>
                    <th className="px-3 py-2 text-left">Estado actual</th>
                    <th className="px-3 py-2 text-right">Mensual</th>
                  </tr>
                </thead>
                <tbody>
                  {(catalog?.features ?? []).map((feature) => {
                    const isChecked = selectedFeatureKeys.includes(feature.key);
                    const statusLabel =
                      feature.status === "active"
                        ? "Activa"
                        : feature.status === "trial"
                          ? `Trial (${feature.trialDaysRemaining} días)`
                          : feature.status === "expired"
                            ? "Trial expirado"
                            : "Sin activar";

                    return (
                      <tr key={feature.key} className="border-t">
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              toggleFeature(feature.key, Boolean(checked))
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-900">{feature.label}</td>
                        <td className="px-3 py-2 text-slate-600">{statusLabel}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatPrice(feature.monthlyPrice)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-dashed pt-2">
            {discountApplied > 0 && (
              <ReceiptFooter label="SUBTOTAL:" orderTotal={total} />
            )}
            <ReceiptFooter label="TOTAL MENSUAL:" orderTotal={finalTotal} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}