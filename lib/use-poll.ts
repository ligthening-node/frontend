"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, toApiError } from "@/lib/api";
import { useNodeEvents } from "@/lib/node-events";

export interface PollState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Calls `fetcher` on mount, every `intervalMs`, and whenever the node emits a live event (a
 * payment landing or a channel changing state should show up without waiting for the next tick).
 * Keeps the last good data while an error shows.
 */
export function usePoll<T>(fetcher: () => Promise<T>, intervalMs: number): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [tick, setTick] = useState<number>(0);
  const { eventCount } = useNodeEvents();

  const refresh = useCallback((): void => setTick((n: number): number => n + 1), []);

  useEffect((): (() => void) => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        const next = await fetcher();
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(toApiError(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void run();
    const timer = setInterval((): void => void run(), intervalMs);
    return (): void => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fetcher, intervalMs, tick, eventCount]);

  return { data, error, loading, refresh };
}
