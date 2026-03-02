"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";

export default function BillingOnboardingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payerEmail: email }),
      });

      const data = (await res.json()) as { init_point?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Error al crear la suscripción");
        return;
      }

      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        setError("No se recibió el enlace de pago");
      }
    } catch {
      setError("Error de red. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-violet-600" />
          <h1 className="text-xl font-semibold text-slate-900">
            Activar suscripción
          </h1>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Ingresa el correo electrónico asociado a tu cuenta de MercadoPago para
          iniciar el proceso de pago del plan mensual.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="payer-email"
              className="text-xs font-medium text-slate-700"
            >
              Correo electrónico (MercadoPago)
            </label>
            <input
              id="payer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            onClick={handleSubscribe}
            disabled={loading || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando…
              </>
            ) : (
              "Suscribirse — Plan Mensual"
            )}
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Serás redirigido al checkout seguro de MercadoPago para completar el
          pago.
        </p>
      </div>
    </div>
  );
}
