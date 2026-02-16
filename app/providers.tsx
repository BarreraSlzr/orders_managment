"use client";

import AdminQueryListener from "@/components/Admin/AdminQueryListener";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <AdminQueryListener />
      {children}
    </NuqsAdapter>
  );
}
