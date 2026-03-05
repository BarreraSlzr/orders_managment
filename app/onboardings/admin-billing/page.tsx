"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { useTRPC } from "@/lib/trpc/react";
import { formatPrice } from "@/lib/utils/formatPrice";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function AdminBillingPage() {
  const trpc = useTRPC();
  const { role, tenantName, isLoading } = useAdminStatus();
  const isSystemAdmin = role === "admin" && tenantName === "system";

  const [tenantId, setTenantId] = useState("all");
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"amount_off" | "feature_unlock">("amount_off");
  const [amountType, setAmountType] = useState<"percentage" | "fixed">("percentage");
  const [amountValue, setAmountValue] = useState("10");
  const [unlockDays, setUnlockDays] = useState("30");
  const [featureKeys, setFeatureKeys] = useState("mercadopago_sync");

  const tenantsQuery = useQuery({
    ...trpc.users.listSystemTenants.queryOptions(),
    enabled: isSystemAdmin,
  });

  const dashboardQuery = useQuery(
    trpc.admin.billingTenantsDashboard.queryOptions(
      tenantId !== "all" ? { tenantId } : undefined,
    ),
  );

  const discountCodesQuery = useQuery(trpc.admin.discountCodesList.queryOptions());

  const upsertDiscount = useMutation(trpc.admin.discountCodeUpsert.mutationOptions({
    onSuccess: () => {
      void discountCodesQuery.refetch();
      void dashboardQuery.refetch();
    },
  }));

  const setDiscountActive = useMutation(trpc.admin.discountCodeSetActive.mutationOptions({
    onSuccess: () => {
      void discountCodesQuery.refetch();
    },
  }));

  const usageHeaders = useMemo(() => {
    const keys = new Set<string>();
    for (const tenant of dashboardQuery.data?.tenants ?? []) {
      for (const usage of tenant.usage) {
        keys.add(usage.key);
      }
    }
    return Array.from(keys).sort();
  }, [dashboardQuery.data]);

  if (isLoading) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading…</div>;
  }

  if (!isSystemAdmin) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
        Solo system admin puede ver este dashboard. <Link href="/onboardings" className="underline">Regresar</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin Billing</p>
        <h1 className="text-2xl font-semibold text-slate-900">Tenant billings + discounts</h1>
      </header>

      <section className="rounded-2xl border bg-white/90 p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Tenant</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger>
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {(tenantsQuery.data ?? []).map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-slate-500">Tenants</p>
            <p className="text-xl font-semibold">{dashboardQuery.data?.summary.totalTenants ?? 0}</p>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-slate-500">With subscription</p>
            <p className="text-xl font-semibold">{dashboardQuery.data?.summary.withSubscription ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white/90 p-5 space-y-3">
        <h2 className="text-lg font-semibold">Discount codes</h2>
        <div className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1 md:col-span-2">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" />
          </div>
          <div className="space-y-1">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "amount_off" | "feature_unlock")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="amount_off">Amount off</SelectItem>
                <SelectItem value="feature_unlock">Feature unlock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "amount_off" ? (
            <>
              <div className="space-y-1">
                <Label>Amount type</Label>
                <Select value={amountType} onValueChange={(v) => setAmountType(v as "percentage" | "fixed")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input type="number" min={0} value={amountValue} onChange={(e) => setAmountValue(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Unlock days</Label>
                <Input type="number" min={1} value={unlockDays} onChange={(e) => setUnlockDays(e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Feature keys (comma)</Label>
                <Input value={featureKeys} onChange={(e) => setFeatureKeys(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <Button
          onClick={() => {
            void upsertDiscount.mutateAsync({
              code,
              kind,
              amountType: kind === "amount_off" ? amountType : undefined,
              amountValue: kind === "amount_off" ? Number(amountValue || 0) : undefined,
              unlockDays: kind === "feature_unlock" ? Number(unlockDays || 0) : undefined,
              featureKeys:
                kind === "feature_unlock"
                  ? featureKeys.split(",").map((item) => item.trim()).filter(Boolean) as Array<
                      | "sales_history_extended"
                      | "mercadopago_sync"
                      | "multi_manager_users"
                      | "payment_method_advanced"
                      | "quick_add_product"
                      | "order_expenses"
                      | "product_composition"
                    >
                  : undefined,
              active: true,
            });
          }}
          disabled={upsertDiscount.isPending || !code.trim()}
        >
          {upsertDiscount.isPending ? "Saving..." : "Save discount"}
        </Button>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase">
              <tr>
                <th className="px-2 py-2 text-left">Code</th>
                <th className="px-2 py-2 text-left">Kind</th>
                <th className="px-2 py-2 text-left">Value</th>
                <th className="px-2 py-2 text-left">Redemptions</th>
                <th className="px-2 py-2 text-left">Active</th>
              </tr>
            </thead>
            <tbody>
              {(discountCodesQuery.data ?? []).map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-2 py-2">{row.code}</td>
                  <td className="px-2 py-2">{row.kind}</td>
                  <td className="px-2 py-2">
                    {row.kind === "amount_off"
                      ? `${row.amount_value ?? 0}${row.amount_type === "percentage" ? "%" : ""}`
                      : `${row.unlock_days ?? 0}d`}
                  </td>
                  <td className="px-2 py-2">{row.redeemed_count}/{row.max_redemptions ?? "∞"}</td>
                  <td className="px-2 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void setDiscountActive.mutateAsync({ id: row.id, active: !row.active })}
                    >
                      {row.active ? "Disable" : "Enable"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-white/90 p-5 space-y-3">
        <h2 className="text-lg font-semibold">Tenant billing analysis</h2>
        <div className="overflow-x-auto rounded border">
          <table className="w-full min-w-[840px] text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase">
              <tr>
                <th className="px-2 py-2 text-left">Tenant</th>
                <th className="px-2 py-2 text-left">Sub status</th>
                <th className="px-2 py-2 text-right">Current amount</th>
                {usageHeaders.map((key) => (
                  <th key={key} className="px-2 py-2 text-right">use:{key}</th>
                ))}
                <th className="px-2 py-2 text-right">Discount uses</th>
              </tr>
            </thead>
            <tbody>
              {(dashboardQuery.data?.tenants ?? []).map((tenant) => {
                const amount = Number((tenant.subscription?.metadata as Record<string, unknown> | null)?.amount ?? 0);
                return (
                  <tr key={tenant.id} className="border-t">
                    <td className="px-2 py-2">
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-[10px] text-slate-500">{tenant.id}</div>
                    </td>
                    <td className="px-2 py-2">{tenant.subscription?.status ?? tenant.entitlement.subscriptionStatus}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatPrice(amount)}</td>
                    {usageHeaders.map((key) => {
                      const row = tenant.usage.find((usage) => usage.key === key);
                      return <td key={key} className="px-2 py-2 text-right">{row?.usageCount ?? 0}</td>;
                    })}
                    <td className="px-2 py-2 text-right">{tenant.discounts.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
