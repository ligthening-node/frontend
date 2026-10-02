import type { ReactElement } from "react";

import { formatMsat } from "@/lib/format";

/** Local share of the channel in percent, from msat strings. Integer math so huge values stay exact. */
export function localPercent(outboundMsat: string, inboundMsat: string): number {
  const outbound = BigInt(outboundMsat);
  const total = outbound + BigInt(inboundMsat);
  if (total === BigInt(0)) {
    return 0;
  }
  return Number((outbound * BigInt(100)) / total);
}

/**
 * A channel keeps a few hundred sat of the funder's balance back for fees and can never spend it, so
 * a side is never exactly empty. Anything below this counts as nothing left.
 */
export const UNSPENDABLE_MSAT = BigInt(1_000_000);

/** `msat` as a bigint, with the unspendable leftover rounded down to zero. */
export function spendableMsat(msat: string): bigint {
  const value = BigInt(msat);
  return value < UNSPENDABLE_MSAT ? BigInt(0) : value;
}

/**
 * What is still on our side, as a share of everything the channel can move, in percent. A new
 * channel starts at 100 (nothing has moved to the other side) and the figure falls to 0 as payments
 * leave. Reserves, the opening fee and the unspendable leftover are left out of both sides.
 */
export function balancePercent(outboundMsat: string, inboundMsat: string): number {
  const outbound = spendableMsat(outboundMsat);
  const total = outbound + spendableMsat(inboundMsat);
  if (total === BigInt(0)) {
    return 0;
  }
  return Number((outbound * BigInt(100)) / total);
}

/**
 * A range bar for one channel: full when the channel is new, emptying as sats are sent and filling
 * on the other node as they arrive. The two bars (one per node) always move in opposite directions.
 */
export function LiquidityBar({
  outboundMsat,
  inboundMsat,
  completed = false,
}: {
  outboundMsat: string;
  inboundMsat: string;
  /** A completed channel has nothing left to move, so the bar is not drawn; only the amounts stay. */
  completed?: boolean;
}): ReactElement {
  const percent = balancePercent(outboundMsat, inboundMsat);
  const totalMsat = (BigInt(outboundMsat) + BigInt(inboundMsat)).toString();
  return (
    <div className="flex flex-col gap-1.5">
      {!completed && (
        <>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Channel balance</span>
            <span className="font-medium tabular-nums">{percent}%</span>
          </div>
          <div
            role="meter"
            aria-label="Our share of the channel"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="relative h-3 w-full rounded-full bg-muted"
          >
            <div
              className="h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out-strong"
              style={{ width: "100%", transform: `scaleX(${percent / 100})` }}
            />
            <div
              aria-hidden
              className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow transition-[left] duration-500 ease-out-strong"
              style={{ left: `${Math.min(97, Math.max(3, percent))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 sat</span>
            <span>{formatMsat(totalMsat)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-primary" />
          Can send {formatMsat(outboundMsat)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-muted-foreground/40" />
          Can receive {formatMsat(inboundMsat)}
        </span>
      </div>
    </div>
  );
}
