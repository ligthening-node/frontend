"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type { NodeEvent } from "@/lib/types/NodeEvent";

const MAX_KEPT = 20;
const RETRY_MS = 10000;

export interface ReceivedEvent {
  id: number;
  at: number;
  event: NodeEvent;
}

export interface NodeEventsState {
  events: ReceivedEvent[];
  /** Grows by one per event; pages refetch when it changes. */
  eventCount: number;
  dismiss: (id: number) => void;
}

const NodeEventsContext = createContext<NodeEventsState>({
  events: [],
  eventCount: 0,
  dismiss: (): void => {},
});

export function parseNodeEvent(data: string): NodeEvent | null {
  try {
    const value: unknown = JSON.parse(data);
    if (typeof value === "object" && value !== null && "kind" in value) {
      return value as NodeEvent;
    }
  } catch {
    // A malformed frame is dropped; the next one may be fine.
  }
  return null;
}

/**
 * One EventSource for the whole app. The browser only reconnects by itself after network errors;
 * an error response (node down, so the proxy answers 502) closes the stream, so we retry.
 * The decoder needs no node, and on the public deployment there is none, so it never connects.
 */
export function NodeEventsProvider({ children }: { children: ReactNode }): ReactElement {
  const [events, setEvents] = useState<ReceivedEvent[]>([]);
  const [eventCount, setEventCount] = useState<number>(0);
  const nextId = useRef<number>(0);
  const pathname = usePathname();
  const wantsEvents = !pathname.startsWith("/decode");

  useEffect((): (() => void) | undefined => {
    if (!wantsEvents || typeof EventSource === "undefined") {
      return undefined;
    }
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = (): void => {
      source = new EventSource("/api/events");
      source.onmessage = (message: MessageEvent<string>): void => {
        const event = parseNodeEvent(message.data);
        if (event === null) {
          return;
        }
        nextId.current += 1;
        setEventCount(nextId.current);
        // A list-changed signal only makes pages refetch; it is not worth a toast.
        if (event.kind === "payments_changed") {
          return;
        }
        const received: ReceivedEvent = { id: nextId.current, at: Date.now(), event };
        setEvents((prev: ReceivedEvent[]): ReceivedEvent[] => [received, ...prev].slice(0, MAX_KEPT));
      };
      source.onerror = (): void => {
        if (source?.readyState === EventSource.CLOSED) {
          retry = setTimeout(connect, RETRY_MS);
        }
      };
    };
    connect();

    return (): void => {
      source?.close();
      if (retry !== null) {
        clearTimeout(retry);
      }
    };
  }, [wantsEvents]);

  const dismiss = (id: number): void => {
    setEvents((prev: ReceivedEvent[]): ReceivedEvent[] => prev.filter((e: ReceivedEvent): boolean => e.id !== id));
  };

  return <NodeEventsContext value={{ events, eventCount, dismiss }}>{children}</NodeEventsContext>;
}

export function useNodeEvents(): NodeEventsState {
  return useContext(NodeEventsContext);
}
