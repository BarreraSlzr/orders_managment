"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

interface LoginFormProps {
  defaultTenant?: string;
}

export default function LoginForm({ defaultTenant }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirect = rawRedirect.startsWith("/") ? rawRedirect : "/";

  const [tenant, setTenant] = useState(defaultTenant ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDisabled = useMemo(() => {
    if (defaultTenant) {
      return !username.trim() || !password;
    }
    return !tenant.trim() || !username.trim() || !password;
  }, [defaultTenant, tenant, username, password]);

  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      setError(null);
      setIsSubmitting(true);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            tenant: (defaultTenant ?? tenant).trim(),
            username: username.trim(),
            password,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Login failed");
        }

        window.location.assign(redirect);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
      } finally {
        setIsSubmitting(false);
      }
    },
    [defaultTenant, tenant, username, password, redirect],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-xl"
      >
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Secure Access
          </p>
          <h1 className="text-2xl font-semibold">Sign in to continue</h1>
          <p className="mt-2 text-sm text-slate-400">
            Use your tenant name and credentials to access onboarding and
            operations.
          </p>
        </div>

        <div className="space-y-4">
          {defaultTenant ? (
            <div className="space-y-2">
              <Label>Tenant</Label>
              <div className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                {defaultTenant}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="tenant">Tenant</Label>
              <Input
                id="tenant"
                value={tenant}
                onChange={(event) => setTenant(event.target.value)}
                placeholder="cafe&baguettes"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            type="submit"
            disabled={isDisabled || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </div>
      </form>
    </div>
  );
}
