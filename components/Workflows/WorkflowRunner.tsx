"use client";

import { WorkflowDefinition, WorkflowStep } from "@/lib/workflows/definitions";
import { useCallback, useMemo, useState } from "react";
import { ZodSchema } from "zod";
import { WorkflowTimeline } from "./WorkflowTimeline";

type StepStatus = "pending" | "active" | "completed" | "error";

interface WorkflowRunnerProps {
  definition: WorkflowDefinition;
  initialData?: Record<string, unknown>;
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  isReadOnly?: boolean;
  renderStep: (params: {
    step: WorkflowStep;
    data: Record<string, unknown>;
    onChange: (params: { data: Record<string, unknown> }) => void;
  }) => React.ReactNode;
}

interface StepValidationResult {
  ok: boolean;
  error?: string;
}

function validateStepData(params: {
  schema: ZodSchema;
  data: Record<string, unknown>;
}): StepValidationResult {
  const result = params.schema.safeParse(params.data);
  if (result.success) {
    return { ok: true };
  }
  const message = result.error.issues.map((issue) => issue.message).join(", ");
  return { ok: false, error: message };
}

export function WorkflowRunner({
  definition,
  initialData,
  onComplete,
  isReadOnly = false,
  renderStep,
}: WorkflowRunnerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [stepData, setStepData] = useState<Record<string, unknown>>(
    initialData ?? {},
  );
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    definition.steps.map((_, index) => (index === 0 ? "active" : "pending")),
  );
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeStep = definition.steps[activeIndex];
  const isLastStep = activeIndex === definition.steps.length - 1;

  const updateStepData = useCallback(
    (params: { data: Record<string, unknown> }) => {
      setStepData((prev) => ({ ...prev, ...params.data }));
      setStepError(null);
      setStepStatuses((prev) => {
        const next = [...prev];
        if (next[activeIndex] === "error") {
          next[activeIndex] = "active";
        }
        return next;
      });
    },
    [activeIndex],
  );

  const markStepStatus = useCallback(
    (params: { index: number; status: StepStatus }) => {
      setStepStatuses((prev) => {
        const next = [...prev];
        next[params.index] = params.status;
        return next;
      });
    },
    [],
  );

  const handleNext = useCallback(async () => {
    const validation = validateStepData({
      schema: activeStep.schema,
      data: stepData,
    });

    if (!validation.ok) {
      setStepError(validation.error ?? "Validation failed");
      markStepStatus({ index: activeIndex, status: "error" });
      return;
    }

    markStepStatus({ index: activeIndex, status: "completed" });

    if (!isLastStep) {
      const nextIndex = activeIndex + 1;
      setActiveIndex(nextIndex);
      markStepStatus({ index: nextIndex, status: "active" });
      return;
    }

    if (isReadOnly) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onComplete(stepData);
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "Submission failed",
      );
      markStepStatus({ index: activeIndex, status: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeIndex,
    activeStep,
    isLastStep,
    isReadOnly,
    markStepStatus,
    onComplete,
    stepData,
  ]);

  const handlePrev = useCallback(() => {
    if (activeIndex === 0) return;
    const prevIndex = activeIndex - 1;
    setActiveIndex(prevIndex);
    markStepStatus({ index: prevIndex, status: "active" });
  }, [activeIndex, markStepStatus]);

  const handleStepClick = useCallback(
    (params: { index: number }) => {
      if (params.index === activeIndex) return;

      if (params.index < activeIndex) {
        setActiveIndex(params.index);
        markStepStatus({ index: params.index, status: "active" });
        return;
      }

      const canAdvance = stepStatuses
        .slice(0, params.index)
        .every((status) => status === "completed");

      if (canAdvance) {
        setActiveIndex(params.index);
        markStepStatus({ index: params.index, status: "active" });
      }
    },
    [activeIndex, markStepStatus, stepStatuses],
  );

  const stepTitle = useMemo(() => activeStep.title, [activeStep.title]);

  return (
    <div className="rounded-2xl border bg-white/80 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4">
        <WorkflowTimeline
          steps={definition.steps}
          activeIndex={activeIndex}
          statuses={stepStatuses}
          onStepClick={handleStepClick}
        />

        <div>
          <h2 className="text-xl font-semibold text-slate-900">{stepTitle}</h2>
          {activeStep.description && (
            <p className="text-sm text-slate-600">{activeStep.description}</p>
          )}
        </div>

        {stepError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {stepError}
          </div>
        )}

        {isReadOnly && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Read-only view. Editing is disabled for this user.
          </div>
        )}

        <div className="min-h-[260px]">
          {renderStep({
            step: activeStep,
            data: stepData,
            onChange: updateStepData,
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeIndex === 0 || isSubmitting}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting || (isReadOnly && isLastStep)}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isLastStep ? (isSubmitting ? "Submitting..." : "Submit") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
