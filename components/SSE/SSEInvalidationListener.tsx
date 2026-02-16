"use client";

import { useSSEInvalidation } from "@/hooks/useSSEInvalidation";

/**
 * Renders nothing — activates the SSE connection for real-time
 * cache invalidation as a side-effect.
 */
export default function SSEInvalidationListener() {
  useSSEInvalidation();
  return null;
}
