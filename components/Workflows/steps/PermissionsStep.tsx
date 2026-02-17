"use client";

import { Checkbox } from "@/components/ui/checkbox";

interface PermissionsStepProps {
  data: Record<string, unknown>;
  onChange: (params: { data: Record<string, unknown> }) => void;
}

const staffPermissionOptions = [
  { key: "orders.create", label: "Create orders" },
  { key: "orders.update", label: "Update orders" },
  { key: "orders.delete", label: "Delete orders" },
  { key: "orders.close", label: "Close orders" },
];

const managerPermissionOptions = [
  ...staffPermissionOptions,
  { key: "products.create", label: "Create products" },
  { key: "products.update", label: "Update products" },
  { key: "products.delete", label: "Delete products" },
  { key: "inventory.items.view", label: "View inventory items" },
  { key: "inventory.items.update", label: "Update inventory items" },
  { key: "inventory.transactions.view", label: "View inventory transactions" },
  {
    key: "inventory.transactions.create",
    label: "Create inventory transactions",
  },
  { key: "reports.view", label: "View reports" },
  { key: "users.manage", label: "Manage users" },
];

export function PermissionsStep({ data, onChange }: PermissionsStepProps) {
  const scope = data.permissionScope === "manager" ? "manager" : "staff";
  const permissions = Array.isArray(data.permissions)
    ? (data.permissions as string[])
    : ["orders.create", "orders.update", "orders.delete", "orders.close"];
  const readOnly =
    Boolean(data.readOnlyUser) || Boolean(data.readOnlyPermissions);
  const permissionOptions =
    scope === "manager" ? managerPermissionOptions : staffPermissionOptions;

  const togglePermission = (key: string) => {
    if (readOnly) return;
    const next = permissions.includes(key)
      ? permissions.filter((permission) => permission !== key)
      : [...permissions, key];

    onChange({ data: { permissions: next } });
  };

  return (
    <div className="space-y-3">
      {permissionOptions.map((permission) => (
        <label key={permission.key} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={permissions.includes(permission.key)}
            onCheckedChange={() => togglePermission(permission.key)}
            disabled={readOnly}
          />
          {permission.label}
        </label>
      ))}
    </div>
  );
}
