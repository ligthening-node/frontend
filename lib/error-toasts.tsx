"use client";

import { XIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api";

const MAX_SHOWN = 3;
const AUTO_DISMISS_MS = 10_000;
/** Matches the 120 ms `toast-exit` animation in globals.css. */
const EXIT_MS = 120;

interface ErrorToast {
  id: number;
  title: string;
  message: string;
  leaving: boolean;
}

type Report = (error: ApiError) => void;

// Without a provider (in tests, for example) reporting does nothing.
const ReportContext = createContext<Report>((): void => {});

/** Reports a failed action so it pops up in the corner. */
export function useReportError(): Report {
  return useContext(ReportContext);
}

function titleFor(error: ApiError): string {
  return error.code === "node_unreachable" ? "The node is offline" : "That did not work";
}

/** Error messages that pop up in the top right and close themselves after a few seconds. */
export function ErrorToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toasts, setToasts] = useState<ErrorToast[]>([]);
  const nextId = useRef<number>(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  /** Plays the exit animation, then removes the toast. */
  const dismiss = useCallback((id: number): void => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    setToasts((prev: ErrorToast[]): ErrorToast[] =>
      prev.map((t: ErrorToast): ErrorToast => (t.id === id ? { ...t, leaving: true } : t)),
    );
    timers.current.set(
      id,
      setTimeout((): void => {
        setToasts((prev: ErrorToast[]): ErrorToast[] => prev.filter((t: ErrorToast): boolean => t.id !== id));
        timers.current.delete(id);
      }, EXIT_MS),
    );
  }, []);

  const report = useCallback(
    (error: ApiError): void => {
      nextId.current += 1;
      const id = nextId.current;
      const toast: ErrorToast = { id, title: titleFor(error), message: error.message, leaving: false };
      setToasts((prev: ErrorToast[]): ErrorToast[] => [toast, ...prev].slice(0, MAX_SHOWN));
      timers.current.set(
        id,
        setTimeout((): void => dismiss(id), AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  useEffect((): (() => void) => {
    const active = timers.current;
    return (): void => {
      active.forEach((timer: ReturnType<typeof setTimeout>): void => clearTimeout(timer));
      active.clear();
    };
  }, []);

  return (
    <ReportContext value={report}>
      {children}
      <div aria-live="assertive" className="pointer-events-none fixed top-[4.5rem] right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast: ErrorToast) => (
          <div
            key={toast.id}
            role="alert"
            data-testid="error-toast"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border border-destructive/50 bg-card px-3 py-2 text-sm shadow-lg ${toast.leaving ? "toast-exit" : "toast-enter"}`}
          >
            <div className="flex-1">
              <p className="font-semibold text-destructive">{toast.title}</p>
              <p>{toast.message}</p>
            </div>
            <Button variant="ghost" size="icon-xs" aria-label="Dismiss error" onClick={(): void => dismiss(toast.id)}>
              <XIcon />
            </Button>
          </div>
        ))}
      </div>
    </ReportContext>
  );
}
