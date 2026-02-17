"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StaffInfoStepProps {
  data: Record<string, unknown>;
  onChange: (params: { data: Record<string, unknown> }) => void;
}

export function StaffInfoStep({ data, onChange }: StaffInfoStepProps) {
  const username = typeof data.username === "string" ? data.username : "";
  const tempPassword =
    typeof data.tempPassword === "string" ? data.tempPassword : "";
  const readOnlyUser = Boolean(data.readOnlyUser);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="staff-username">Staff username</Label>
        <Input
          id="staff-username"
          value={username}
          onChange={(e) => onChange({ data: { username: e.target.value } })}
          disabled={readOnlyUser}
          placeholder="staff username"
        />
      </div>

      <div>
        <Label htmlFor="staff-password">New password (optional)</Label>
        <Input
          id="staff-password"
          type="password"
          value={tempPassword}
          onChange={(e) =>
            onChange({
              data: { tempPassword: e.target.value || undefined },
            })
          }
          disabled={readOnlyUser}
          placeholder="leave blank to keep current"
        />
      </div>
    </div>
  );
}
