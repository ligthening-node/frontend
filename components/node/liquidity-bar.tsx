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

/** Spendable balance as a share of the whole channel in percent (0 to 100), exact with msat strings. */
export function balancePercent(outboundMsat: string, capacitySat: string): number {
  const capacityMsat = BigInt(capacitySat) * BigInt(1000);
  if (capacityMsat === BigInt(0)) {
    return 0;
  }
  const percent = Number((BigInt(outboundMsat) * BigInt(100)) / capacityMsat);
  return Math.min(100, Math.max(0, percent));
}

/**
 * A range bar over the whole channel: the track is the channel amount and the fill is what we can
 * send. It grows when sats arrive on our side and shrinks when we send them away. Reserves are held
 * back on both sides, so the fill never quite reaches either end.
 */
export function LiquidityBar({
  outboundMsat,
  inboundMsat,
  capacitySat,
}: {
  outboundMsat: string;
  inboundMsat: string;
  capacitySat: string;
}): ReactElement {
  const percent = balancePercent(outboundMsat, capacitySat);
  return (
    <div className="flex flex-col gap-1.5">
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
        <span>{formatMsat((BigInt(capacitySat) * BigInt(1000)).toString())}</span>
      </div>
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
