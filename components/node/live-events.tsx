"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { formatLocalTime, formatMsat, shortHex } from "@/lib/format";
import { useNodeEvents } from "@/lib/node-events";
import type { ReceivedEvent } from "@/lib/node-events";
import type { NodeEvent } from "@/lib/types/NodeEvent";

const SHOWN = 3;
/** Matches the 120 ms `toast-exit` animation in globals.css. */
const EXIT_MS = 120;

export function describeEvent(event: NodeEvent): string {
  switch (event.kind) {
    case "payment_successful":
      return `Payment ${shortHex(event.payment_hash, 6)} succeeded${
        event.fee_paid_msat === null ? "" : `, fee ${formatMsat(event.fee_paid_msat)}`
      }`;
    case "payment_failed":
      return `Payment failed${event.reason === null ? "" : `: ${event.reason}`}`;
    case "payment_received":
      return `Received ${formatMsat(event.amount_msat)}`;
    case "channel_pending":
      return `Channel with ${shortHex(event.counterparty_node_id, 6)} is waiting for confirmations`;
    case "channel_ready":
      return "Channel is ready to use";
    case "channel_closed":
      if (event.reason !== null && event.reason.includes("Suitable channel reserve not found")) {
        return "Channel closed: the peer refused it because it is too small. Each side keeps a 1,000 sat reserve and opening costs about 1,160 sat, so open at least 2,300 sat.";
      }
      return `Channel closed${event.reason === null ? "" : `: ${event.reason}`}`;
    case "payments_changed":
      return "Payments updated";
    case "other":
      return `Node event: ${event.name}`;
  }
}

/** The newest node events as dismissible toasts in the corner. */
export function LiveEvents(): ReactElement {
  const { events, dismiss } = useNodeEvents();
  const [leaving, setLeaving] = useState<ReadonlySet<number>>(new Set());

  /** Plays the exit animation, then removes the event. */
  const close = (id: number): void => {
    setLeaving((prev: ReadonlySet<number>): ReadonlySet<number> => new Set(prev).add(id));
    setTimeout((): void => dismiss(id), EXIT_MS);
  };

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
      {events.slice(0, SHOWN).map((item: ReceivedEvent) => (
        <div
          key={item.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-md ${leaving.has(item.id) ? "toast-exit" : "toast-enter"}`}
        >
          <div className="flex-1">
            <p>{describeEvent(item.event)}</p>
            <time dateTime={new Date(item.at).toISOString()} className="text-xs text-muted-foreground">
              {formatLocalTime(item.at)}
            </time>
          </div>
          <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={(): void => close(item.id)}>
            <XIcon />
          </Button>
        </div>
      ))}
    </div>
  );
}
