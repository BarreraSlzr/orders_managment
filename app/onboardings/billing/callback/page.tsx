"use client";

import { CheckCircle2, Clock, Home, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BillingCallbackContent() {
  const searchParams = useSearchParams();
  const preapprovalId = searchParams.get("preapproval_id");
  const status = searchParams.get("status");

  const isError = status === "failure" || status === "rejected";
  const isPending = !preapprovalId || status === "pending";
  const isSuccess = preapprovalId && !isError && !isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        {isError ? (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">
              Error en la suscripción
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              No se pudo completar el proceso de suscripción. Por favor, intenta
              de nuevo.
            </p>
            <div className="mt-6">
              <Link
                href="/onboardings/billing"
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Intentar de nuevo
              </Link>
            </div>
          </>
        ) : isPending ? (
          <>
            <Clock className="mx-auto h-12 w-12 text-amber-500" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">
              Suscripción pendiente
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Tu suscripción está siendo procesada. Recibirás una confirmación
              cuando esté activa.
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
              >
                <Home className="h-4 w-4" />
                Ir a Inicio
              </Link>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">
              ¡Suscripción confirmada!
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Tu suscripción ha sido activada correctamente. Ya puedes continuar
              con la configuración de tu cuenta.
            </p>
            {preapprovalId && (
              <p className="mt-2 text-xs text-slate-400">
                ID de suscripción: {preapprovalId}
              </p>
            )}
            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <Home className="h-4 w-4" />
                Ir a configuración
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingCallbackPage() {
  return (
    <Suspense>
      <BillingCallbackContent />
    </Suspense>
  );
}
