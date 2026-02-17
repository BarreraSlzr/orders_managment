"use client";

import { Checkbox } from "@/components/ui/checkbox";

interface ReviewStepProps {
  data: Record<string, unknown>;
  title: string;
  items: Array<{ label: string; value: string }>;
  onChange: (params: { data: Record<string, unknown> }) => void;
}

export function ReviewStep({ data, title, items, onChange }: ReviewStepProps) {
  const confirmCreation = data.confirmCreation === true;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 text-sm">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div className="mt-2 space-y-2 text-slate-600">
          {items.map((item) => (
            <div key={item.label} className="flex justify-between gap-4">
              <span>{item.label}</span>
              <span className="font-medium text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={confirmCreation}
          onCheckedChange={(checked) =>
            onChange({ data: { confirmCreation: Boolean(checked) } })
          }
        />
        I confirm these details are correct.
      </label>
    </div>
  );
}
