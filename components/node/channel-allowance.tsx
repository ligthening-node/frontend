import type { ReactElement } from "react";

import { formatMsat } from "@/lib/format";

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
 * What the channel is allowed to move in total: what we can send plus what we can receive. Payments
 * only shift sats between the two sides, so this stays the same while "left to send" counts down.
 */
export function totalAllowedMsat(outboundMsat: string, inboundMsat: string): bigint {
  return BigInt(outboundMsat) + BigInt(inboundMsat);
}

/**
 * The channel's transaction allowance as numbers, with no bar: the total it may transact, and how
 * much of it is still left to send and to receive. "Left to send" falls sat by sat as payments go
 * out and reaches 0 sat when the channel is used up.
 */
export function ChannelAllowance({
  outboundMsat,
  inboundMsat,
}: {
  outboundMsat: string;
  inboundMsat: string;
}): ReactElement {
  const total = totalAllowedMsat(outboundMsat, inboundMsat).toString();
  const left = spendableMsat(outboundMsat).toString();
  const incoming = spendableMsat(inboundMsat).toString();
  return (
    <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-xs" data-testid="channel-allowance">
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground">Total allowed to transact</dt>
        <dd className="text-sm font-medium tabular-nums">{formatMsat(total)}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground">Left to send</dt>
        <dd className="text-sm font-medium tabular-nums">{formatMsat(left)}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground">Left to receive</dt>
        <dd className="text-sm font-medium tabular-nums">{formatMsat(incoming)}</dd>
      </div>
    </dl>
  );
}
