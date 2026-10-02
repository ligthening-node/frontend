import type { ReactElement } from "react";

import { formatMsat } from "@/lib/format";
import type { ChannelView } from "@/lib/types/ChannelView";

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

/** Two anchor outputs of 330 sat each, held back from the funder when the channel is opened. */
const ANCHOR_OVERHEAD_MSAT = BigInt(660_000);

/**
 * What the channel is allowed to move in total, fixed for the life of the channel: its size, minus
 * the anchor outputs, minus the reserve the funder must keep. A 1,000,000 sat channel is 989,340 sat
 * and a 20,000 sat channel is 18,340 sat, whatever has been paid since. The two sides' "left to send"
 * figures change as payments flow, and (because the other side's reserve is also held back) they add
 * up to a little less than this. Falls back to their sum when the reserve is not known.
 */
export function totalAllowedMsat(
  capacitySat: string,
  funderReserveSat: string | null,
  outboundMsat: string,
  inboundMsat: string,
): bigint {
  if (funderReserveSat === null) {
    return BigInt(outboundMsat) + BigInt(inboundMsat);
  }
  const total = BigInt(capacitySat) * BigInt(1000) - ANCHOR_OVERHEAD_MSAT - BigInt(funderReserveSat) * BigInt(1000);
  return total > BigInt(0) ? total : BigInt(outboundMsat) + BigInt(inboundMsat);
}

/**
 * The channel's transaction allowance as numbers, with no bar: the fixed total it may transact, and
 * how much is still left to send and to receive. Those two change in real time as payments go out
 * and come in; "left to send" reaches 0 sat when the channel is used up.
 */
export function ChannelAllowance({ channel }: { channel: ChannelView }): ReactElement {
  const funderReserve = channel.is_outbound ? channel.our_reserve_sat : channel.their_reserve_sat;
  const total = totalAllowedMsat(channel.capacity_sat, funderReserve, channel.outbound_msat, channel.inbound_msat);
  const left = spendableMsat(channel.outbound_msat).toString();
  const incoming = spendableMsat(channel.inbound_msat).toString();
  return (
    <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-xs" data-testid="channel-allowance">
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground">Total allowed to transact</dt>
        <dd className="text-sm font-medium tabular-nums">{formatMsat(total.toString())}</dd>
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
