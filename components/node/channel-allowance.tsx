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
 * What can actually be moved between the two sides: the channel size minus the anchor outputs,
 * minus the reserve the funder must keep. It is smaller than the capacity, because part of the
 * channel is always held back, and it only sizes the leftover limit below.
 */
export function spendableTotalMsat(
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

/** The total this channel is allowed to transact: its capacity, fixed for the life of the channel. */
export function channelTotalMsat(channel: ChannelView): bigint {
  return BigInt(channel.capacity_sat) * BigInt(1000);
}

/** What can really move between the two sides (see `spendableTotalMsat`). */
function channelSpendableTotalMsat(channel: ChannelView): bigint {
  const funderReserve = channel.is_outbound ? channel.our_reserve_sat : channel.their_reserve_sat;
  return spendableTotalMsat(channel.capacity_sat, funderReserve, channel.outbound_msat, channel.inbound_msat);
}

/**
 * What is left to send and to receive, with the funder's unspendable leftover shown as 0. The funder
 * is the side that holds the money first, so its "left to send" and the other side's "left to
 * receive" are the figures that run down to 0 sat when the channel is used up.
 */
export function leftToMove(channel: ChannelView): { send: bigint; receive: bigint } {
  const total = channelSpendableTotalMsat(channel);
  return {
    send: channel.is_outbound ? spendableMsat(channel.outbound_msat, total) : BigInt(channel.outbound_msat),
    receive: channel.is_outbound ? BigInt(channel.inbound_msat) : spendableMsat(channel.inbound_msat, total),
  };
}

export interface Progress {
  /** The capacity: what the channel is allowed to transact in total. */
  total: bigint;
  /** Sats that have moved to the other side so far. 0 on a new channel. */
  transacted: bigint;
  /** `total - transacted`: equal to the capacity on a new channel, 0 once the channel is completed. */
  left: bigint;
}

/**
 * How much of the capacity has been transacted. The funder holds all the money at the start, so what
 * has moved is what the funder can no longer send, and both nodes read it the same way: from the
 * funder's own balance, or from the other side's inbound figure, which is the same amount. Once the
 * funder has nothing spendable left, the part the channel holds back (reserves and fees) counts as
 * used too, so the channel ends at exactly 0 left.
 */
export function transactionProgress(channel: ChannelView): Progress {
  const total = channelTotalMsat(channel);
  const spendable = channelSpendableTotalMsat(channel);
  const funderLeft = BigInt(channel.is_outbound ? channel.outbound_msat : channel.inbound_msat);
  if (funderLeft < unspendableLimitMsat(spendable)) {
    return { total, transacted: total, left: BigInt(0) };
  }
  const moved = spendable - funderLeft;
  const transacted = moved < BigInt(0) ? BigInt(0) : moved > total ? total : moved;
  return { total, transacted, left: total - transacted };
}

/**
 * The channel's transaction allowance as numbers, with no bar. It starts with the capacity as the
 * total and as the remaining capacity, then "transacted" grows and "left" falls to 0 sat as
 * payments move sats; left to send and left to receive follow each side's balance in real time.
 */
export function ChannelAllowance({ channel }: { channel: ChannelView }): ReactElement {
  const progress = transactionProgress(channel);
  const left = leftToMove(channel);
  const cells: [string, bigint][] = [
    ["Capacity", progress.total],
    ["Transacted so far", progress.transacted],
    ["Remaining capacity", progress.left],
    ["Left to send", left.send],
    ["Left to receive", left.receive],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-5" data-testid="channel-allowance">
      {cells.map(([label, msat]: [string, bigint]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium tabular-nums">{formatMsat(msat.toString())}</dd>
        </div>
      ))}
      <p className="col-span-2 text-muted-foreground sm:col-span-5">
        Part of the capacity (reserves and fees) is held back and can never be sent. It counts as used once the channel is
        completed, when the remaining capacity reaches 0.
      </p>
    </dl>
  );
}
