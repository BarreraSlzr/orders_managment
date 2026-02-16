"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";

interface AdminIdentity {
  role: string;
  key: string;
  username: string;
  email: string;
}

type AdminParseResult =
  | { ok: true; value: AdminIdentity }
  | { ok: false; error: string };

function parseAdminParam({
  value,
}: {
  value: string | null;
}): AdminParseResult {
  if (!value) return { ok: false, error: "Missing admin query parameter." };
  const parts = value.split(":");
  if (parts.length !== 4) {
    return {
      ok: false,
      error: "Invalid admin format. Expected role:key:username:email.",
    };
  }

  const [role, key, username, email] = parts.map((part) => part.trim());
  if (!role || !key || !username || !email) {
    return {
      ok: false,
      error: "Admin format contains empty fields.",
    };
  }

  return {
    ok: true,
    value: { role, key, username, email },
  };
}

/** Simple role param: ?role=admin or ?role=manager */
type RoleParseResult =
  | { ok: true; role: string }
  | { ok: false };

function parseRoleParam({ value }: { value: string | null }): RoleParseResult {
  if (!value) return { ok: false };
  const role = value.trim().toLowerCase();
  if (role === "admin" || role === "manager") {
    return { ok: true, role };
  }
  return { ok: false };
}

async function submitAdminVerification(params: {
  payload: AdminIdentity;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("/api/admin/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      admin: params.payload,
      password: params.password,
    }),
  });

  if (response.ok) return { ok: true };

  const data = await response.json().catch(() => ({}));
  return { ok: false, error: data.error || "Unauthorized" };
}

async function submitRoleVerification(params: {
  role: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("/api/admin/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      admin: {
        role: params.role,
        key: "role-access",
        username: params.role,
        email: `${params.role}@local`,
      },
      password: params.password,
    }),
  });

  if (response.ok) return { ok: true };

  const data = await response.json().catch(() => ({}));
  return { ok: false, error: data.error || "Unauthorized" };
}

export default function AdminQueryListener() {
  const [adminParam, setAdminParam] = useQueryState("admin");
  const [roleParam, setRoleParam] = useQueryState("role");
  const parsed = useMemo(
    () => parseAdminParam({ value: adminParam }),
    [adminParam]
  );
  const roleParsed = useMemo(
    () => parseRoleParam({ value: roleParam }),
    [roleParam]
  );
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"admin" | "role">("admin");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ?role=admin takes priority as simpler entry point
    if (roleParam && roleParsed.ok) {
      setMode("role");
      setOpen(true);
      setError(null);
      return;
    }

    if (!adminParam) {
      if (!roleParam) {
        setOpen(false);
        setPassword("");
        setError(null);
        setStatus("idle");
      }
      return;
    }

    setMode("admin");
    setOpen(true);
    if (!parsed.ok) {
      setError(parsed.error);
    }
  }, [adminParam, parsed, roleParam, roleParsed]);

  if (!open) return null;

  const isInvalid = mode === "admin" && !parsed.ok;

  const handleClose = () => {
    setAdminParam(null);
    setRoleParam(null);
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!password) {
      setError("Password is required.");
      return;
    }

    setStatus("loading");
    setError(null);

    let result: { ok: boolean; error?: string };

    if (mode === "role" && roleParsed.ok) {
      result = await submitRoleVerification({
        role: roleParsed.role,
        password,
      });
    } else if (mode === "admin" && parsed.ok) {
      result = await submitAdminVerification({
        payload: parsed.value,
        password,
      });
    } else {
      return;
    }

    if (result.ok) {
      setStatus("success");
      setPassword("");
      setAdminParam(null);
      setRoleParam(null);
      setTimeout(() => {
        setOpen(false);
      }, 800);
      return;
    }

    setStatus("idle");
    setError(result.error || "Unauthorized");
  };

  const displayRole = mode === "role" && roleParsed.ok
    ? roleParsed.role
    : mode === "admin" && parsed.ok
    ? parsed.value.role
    : null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {displayRole ? `${displayRole.charAt(0).toUpperCase() + displayRole.slice(1)} Access` : "Admin Access"}
          </p>
          <p className="text-xs text-slate-500">
            Enter the password to continue.
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-600"
          onClick={handleClose}
        >
          Close
        </button>
      </div>

      {mode === "admin" && parsed.ok && (
        <div className="mb-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
          <div>Role: {parsed.value.role}</div>
          <div>User: {parsed.value.username}</div>
          <div>Email: {parsed.value.email}</div>
        </div>
      )}

      {mode === "role" && roleParsed.ok && (
        <div className="mb-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
          <div>Role: {roleParsed.role}</div>
        </div>
      )}

      <div className="space-y-2">
        <Input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={status === "loading" || isInvalid}
        />
        {error && (
          <p className="text-xs text-rose-600" role="alert">
            {error}
          </p>
        )}
        {status === "success" && (
          <p className="text-xs text-emerald-600">Access granted.</p>
        )}
        <Button
          type="button"
          className="w-full"
          onClick={handleSubmit}
          disabled={status === "loading" || isInvalid}
        >
          {status === "loading" ? "Verifying..." : "Verify"}
        </Button>
      </div>
    </div>
  );
}
