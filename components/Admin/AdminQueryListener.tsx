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

export default function AdminQueryListener() {
  const [adminParam, setAdminParam] = useQueryState("admin");
  const parsed = useMemo(() => parseAdminParam({ value: adminParam }), [
    adminParam,
  ]);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminParam) {
      setOpen(false);
      setPassword("");
      setError(null);
      setStatus("idle");
      return;
    }

    setOpen(true);
    if (!parsed.ok) {
      setError(parsed.error);
    }
  }, [adminParam, parsed]);

  if (!open) return null;

  const isInvalid = !parsed.ok;

  const handleClose = () => {
    setAdminParam(null);
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!parsed.ok) return;
    if (!password) {
      setError("Password is required.");
      return;
    }

    setStatus("loading");
    setError(null);

    const result = await submitAdminVerification({
      payload: parsed.value,
      password,
    });

    if (result.ok) {
      setStatus("success");
      setPassword("");
      setAdminParam(null);
      setTimeout(() => {
        setOpen(false);
      }, 800);
      return;
    }

    setStatus("idle");
    setError(result.error || "Unauthorized");
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Admin Access</p>
          <p className="text-xs text-slate-500">
            Enter the admin password to continue.
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

      {parsed.ok && (
        <div className="mb-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
          <div>Role: {parsed.value.role}</div>
          <div>User: {parsed.value.username}</div>
          <div>Email: {parsed.value.email}</div>
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
