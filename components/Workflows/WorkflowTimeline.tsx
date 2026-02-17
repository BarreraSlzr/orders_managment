"use client";

import { WorkflowStep } from "@/lib/workflows/definitions";

type StepStatus = "pending" | "active" | "completed" | "error";

export interface WorkflowTimelineProps {
  steps: WorkflowStep[];
  activeIndex: number;
  statuses: StepStatus[];
  onStepClick: (params: { index: number }) => void;
}

export function WorkflowTimeline({
  steps,
  activeIndex,
  statuses,
  onStepClick,
}: WorkflowTimelineProps) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const status = statuses[index] ?? "pending";
          const isActive = index === activeIndex;

          const baseClasses =
            "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition";
          const statusClasses =
            status === "completed"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : status === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : status === "active"
              ? "border-slate-800 bg-white text-slate-900"
              : "border-slate-200 bg-white text-slate-500";

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick({ index })}
              className={`${baseClasses} ${statusClasses} ${
                isActive ? "shadow-sm" : "hover:border-slate-400"
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] text-white">
                {index + 1}
              </span>
              <span className="whitespace-nowrap">{step.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
