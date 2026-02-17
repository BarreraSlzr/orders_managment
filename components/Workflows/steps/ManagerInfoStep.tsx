"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ManagerInfoStepProps {
  data: Record<string, unknown>;
  onChange: (params: { data: Record<string, unknown> }) => void;
}

export function ManagerInfoStep({ data, onChange }: ManagerInfoStepProps) {
  const managerUsername =
    typeof data.managerUsername === "string" ? data.managerUsername : "";
  const tempPassword =
    typeof data.tempPassword === "string" ? data.tempPassword : "";
  const readOnlyUser = Boolean(data.readOnlyUser);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="manager-username">Manager username</Label>
        <Input
          id="manager-username"
          value={managerUsername}
          onChange={(e) =>
            onChange({ data: { managerUsername: e.target.value } })
          }
          disabled={readOnlyUser}
          placeholder="manager username"
        />
      </div>

      <div>
        <Label htmlFor="manager-password">New password (optional)</Label>
        <Input
          id="manager-password"
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
