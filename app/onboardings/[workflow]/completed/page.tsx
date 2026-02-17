import Link from "next/link";

export default function OnboardingCompletedPage() {
  return (
    <div className="rounded-2xl border bg-white/90 p-6 shadow-sm">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
        Completed
      </div>
      <h1 className="font-[var(--font-onboarding)] text-3xl text-slate-900">
        Workflow complete
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        You can now return to the onboarding list or start another workflow.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/onboardings"
          className="rounded-full border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
        >
          Back to workflows
        </Link>
      </div>
    </div>
  );
}
