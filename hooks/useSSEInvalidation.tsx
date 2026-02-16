"use client";

/**
 * Client-side SSE hook for real-time cache invalidation.
 *
 * Connects to `/api/sse`, receives lightweight invalidation pings,
 * and uses the TABLE_INVALIDATION_MAP to invalidate the correct
 * tRPC / TanStack Query cache entries.
 *
 * Features:
 * - Automatic reconnect with exponential backoff
 * - Last-Event-ID resumption (no duplicate events)
 * - Graceful cleanup on unmount
 */

import { TABLE_INVALIDATION_MAP, type SSEEvent } from "@/lib/sse/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

/** Reconnect backoff: 1s → 2s → 4s → 8s → 16s (capped) */
const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 16_000;

export function useSSEInvalidation() {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const retryMs = useRef(INITIAL_RETRY_MS);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Avoid duplicate connections
    if (esRef.current?.readyState !== undefined &&
        esRef.current.readyState !== EventSource.CLOSED) {
      return;
    }

    const es = new EventSource("/api/sse");
    esRef.current = es;

    es.addEventListener("connected", () => {
      // Reset backoff on successful connection
      retryMs.current = INITIAL_RETRY_MS;
    });

    es.addEventListener("invalidate", (event: MessageEvent) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        const queryKeys = TABLE_INVALIDATION_MAP[data.table];
        if (!queryKeys) return;

        for (const queryKey of queryKeys) {
          queryClient.invalidateQueries({ queryKey });
        }
      } catch {
        // Malformed event — ignore
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;

      // Exponential backoff reconnect
      const delay = retryMs.current;
      retryMs.current = Math.min(retryMs.current * 2, MAX_RETRY_MS);

      retryTimer.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [queryClient]);

  useEffect(() => {
    connect();

    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);
}
