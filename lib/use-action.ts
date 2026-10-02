"use client";

import { useState } from "react";

import { ApiError, toApiError } from "@/lib/api";
import { useReportError } from "@/lib/error-toasts";

export interface ActionState {
  busy: boolean;
  error: ApiError | null;
  /** Runs `action`, tracking busy and error. Resolves to false when it threw. */
  run: (action: () => Promise<void>) => Promise<boolean>;
  clearError: () => void;
}

/** Busy and error state for a button or form that calls the node. */
export function useAction(): ActionState {
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const reportError = useReportError();

  async function run(action: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err: unknown) {
      const apiError = toApiError(err);
      setError(apiError);
      reportError(apiError);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run, clearError: (): void => setError(null) };
}
