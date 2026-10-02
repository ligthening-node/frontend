import type { ReactElement } from "react";

import { formatMsat } from "@/lib/format";
import type { ChannelView } from "@/lib/types/ChannelView";

/**
 * A channel holds back part of the funder's balance for fees and reserves and can never send it. It
 * is a few hundred sat on a fresh channel and up to about 2,600 sat once payments have gone both
 * ways, and it does not grow with the channel. Anything below this (or half the total, on a very
 * small channel) counts as nothing left.
 */
const UNSPENDABLE_MAX_MSAT = BigInt(3_000_000);

/** The leftover limit for a channel whose fixed total is `totalMsat`. */
export function unspendableLimitMsat(totalMsat: bigint): bigint {
  const half = totalMsat / BigInt(2);
  return half < UNSPENDABLE_MAX_MSAT ? half : UNSPENDABLE_MAX_MSAT;
}

/** `msat` as a bigint, with the unspendable leftover rounded down to zero. */
export function spendableMsat(msat: string, totalMsat: bigint): bigint {
  const value = BigInt(msat);
  return value < unspendableLimitMsat(totalMsat) ? BigInt(0) : value;
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

/** The fixed total this channel may transact, from the channel itself. */
export function channelTotalMsat(channel: ChannelView): bigint {
  const funderReserve = channel.is_outbound ? channel.our_reserve_sat : channel.their_reserve_sat;
  return totalAllowedMsat(channel.capacity_sat, funderReserve, channel.outbound_msat, channel.inbound_msat);
}

/**
 * What is left to send and to receive, with the funder's unspendable leftover shown as 0. The funder
 * is the side that holds the money first, so its "left to send" and the other side's "left to
 * receive" are the figures that run down to 0 sat when the channel is used up.
 */
export function leftToMove(channel: ChannelView): { send: bigint; receive: bigint } {
  const total = channelTotalMsat(channel);
  return {
    send: channel.is_outbound ? spendableMsat(channel.outbound_msat, total) : BigInt(channel.outbound_msat),
    receive: channel.is_outbound ? BigInt(channel.inbound_msat) : spendableMsat(channel.inbound_msat, total),
  };
}

/**
 * The channel's transaction allowance as numbers, with no bar: the fixed total it may transact, and
 * how much is still left to send and to receive. Those two change in real time as payments go out
 * and come in; the funder's side reaches 0 sat when the channel is used up.
 */
export function ChannelAllowance({ channel }: { channel: ChannelView }): ReactElement {
  const total = channelTotalMsat(channel);
  const left = leftToMove(channel);
  return (
    <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-xs" data-testid="channel-allowance">
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground">Total allowed to transact</dt>
        <dd className="text-sm font-medium tabular-nums">{formatMsat(total.toString())}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground">Left to send</dt>
        <dd className="text-sm font-medium tabular-nums">{formatMsat(left.send.toString())}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground">Left to receive</dt>
        <dd className="text-sm font-medium tabular-nums">{formatMsat(left.receive.toString())}</dd>
      </div>
    </dl>
  );
}
