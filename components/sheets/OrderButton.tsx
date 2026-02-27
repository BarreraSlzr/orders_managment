"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState, PropsWithChildren } from "react";

interface OrderButtonProps {
  onClick: () => void;
  testId: string;
}

export function OrderButton({ onClick, testId, children }: PropsWithChildren<OrderButtonProps>) {
  const ref = useRef<HTMLButtonElement>(null);
  const [count, setCount] = useState(12);

  useEffect(() => {
    if (!ref.current) return;
    const measure = () => {
      const width = ref.current?.offsetWidth ?? 0;
      setCount(Math.ceil(width / 16) + 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <button
      ref={ref}
      onClick={onClick}
      title="Agregar más productos"
      data-testid={testId}
      className="animate-slide-up group relative w-full flex items-center overflow-hidden py-3 rounded-t-xl text-zinc-600 hover:text-zinc-300 transition-colors duration-200"
    >
      <span className="flex items-center" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <ChevronLeft
            key={i}
            className={cn(
              "h-4 w-4 shrink-0",
              i % 6 === 0 && "animate-chevron-6",
              i % 6 === 1 && "animate-chevron-5",
              i % 6 === 2 && "animate-chevron-4",
              i % 6 === 3 && "animate-chevron-3",
              i % 6 === 4 && "animate-chevron-2",
              i % 6 === 5 && "animate-chevron-1",
            )}
          />
        ))}
      </span>
      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-xs font-bold tracking-widest font-mono uppercase text-white px-3 rounded bg-black/60 backdrop-blur-sm shadow-[0_0_16px_8px_rgba(0,0,0,0.55)] group-hover:bg-black/80 transition-colors duration-200">
          {children || `Agregar más productos`}
        </span>
      </span>
    </button>
  );
}
