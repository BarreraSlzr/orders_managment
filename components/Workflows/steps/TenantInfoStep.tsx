"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TenantInfoStepProps {
  data: Record<string, unknown>;
  onChange: (params: { data: Record<string, unknown> }) => void;
}

export function TenantInfoStep({ data, onChange }: TenantInfoStepProps) {
  const tenantName = typeof data.tenantName === "string" ? data.tenantName : "";
  const readOnlyTenant = Boolean(data.readOnlyTenant);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="tenant-name">Tenant name</Label>
        <Input
          id="tenant-name"
          value={tenantName}
          onChange={(e) => onChange({ data: { tenantName: e.target.value } })}
          disabled={readOnlyTenant}
          placeholder="Cafe, bakery, or business name"
        />
        {readOnlyTenant && (
          <p className="mt-1 text-xs text-slate-500">
            Tenant name is locked for edits.
          </p>
        )}
      </div>
    </div>
  );
}
