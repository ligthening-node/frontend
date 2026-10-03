import { isValidPubkey } from "@/components/decoder/context-options";
import { MIN_ONCHAIN_SAT } from "@/lib/format";
import type { PeerView } from "@/lib/types/PeerView";

// === Limits

/**
 * Smallest channel that can work. The peer needs a 1,000 sat reserve on each side after the opening
 * costs (about 500 sat for the first commitment plus 660 sat of anchors), so 500, 1,000 and 2,000 sat
 * were all opened and then closed by the peer. 2,300 sat was the smallest size that became usable.
 */
export const MIN_CHANNEL_SAT = 2300;
/** What must stay on the opener's side after the push, to cover the same costs. */
export const MIN_OUR_SIDE_SAT = 2300;
/** BOLT11 caps the description at 639 bytes. */
export const MAX_DESCRIPTION_LEN = 639;
const MAX_EXPIRY_SECS = 31_536_000;
const DIGITS = /^\d+$/;

// === Amounts

function satValue(input: string): bigint | null {
  return DIGITS.test(input.trim()) ? BigInt(input.trim()) : null;
}

/** Why `input` is not a whole number of sats between `min` and `max`, or null. Empty input is not an error yet. */
export function satAmountError(input: string, min: number, max: bigint | null): string | null {
  if (input.trim() === "") {
    return null;
  }
  const value = satValue(input);
  if (value === null) {
    return "Enter a whole number of sats.";
  }
  if (value < BigInt(min)) {
    return `Must be at least ${min.toLocaleString("en-US")} sat.`;
  }
  if (max !== null && value > max) {
    return `More than you can spend: ${max.toLocaleString("en-US")} sat available.`;
  }
  return null;
}

/** On-chain send: above dust, and no more than the spendable balance (the fee comes on top). */
export function onchainSendError(input: string, spendableSat: string | null): string | null {
  const spendable = spendableSat === null ? null : BigInt(spendableSat);
  const error = satAmountError(input, MIN_ONCHAIN_SAT, spendable);
  if (error !== null && error.startsWith("Must be at least")) {
    return `Below the dust limit. Send at least ${MIN_ONCHAIN_SAT} sat or the network rejects the output.`;
  }
  return error;
}

/** Channel capacity: at least MIN_CHANNEL_SAT, and no more than the spendable balance. */
export function channelCapacityError(input: string, spendableSat: string | null): string | null {
  const error = satAmountError(input, MIN_CHANNEL_SAT, spendableSat === null ? null : BigInt(spendableSat));
  if (error !== null && error.startsWith("Must be at least")) {
    return `Must be at least ${MIN_CHANNEL_SAT.toLocaleString("en-US")} sat: each side keeps a 1,000 sat reserve and opening costs about 1,160 sat, so a smaller channel is closed by the peer.`;
  }
  return error;
}

/** Push amount: optional, and it must leave enough on your side to pay the channel's opening costs. */
export function pushError(push: string, capacity: string): string | null {
  if (push.trim() === "") {
    return null;
  }
  const value = satValue(push);
  if (value === null) {
    return "Enter a whole number of sats.";
  }
  const cap = satValue(capacity);
  if (cap === null) {
    return null;
  }
  if (value >= cap) {
    return "The push amount must be smaller than the channel capacity.";
  }
  if (cap - value < BigInt(MIN_OUR_SIDE_SAT)) {
    return `Leave at least ${MIN_OUR_SIDE_SAT.toLocaleString("en-US")} sat on your side to cover the opening fee.`;
  }
  return null;
}

// === Peer connection

/**
 * Why a channel cannot be opened with `nodeId` yet: the peer must be connected right now. Null when
 * it is, or while the id is still empty or malformed (those have their own messages).
 */
export function peerConnectionError(nodeId: string, peers: PeerView[]): string | null {
  const id = nodeId.trim().toLowerCase();
  if (id === "" || !isValidPubkey(id)) {
    return null;
  }
  const peer = peers.find((p: PeerView): boolean => p.node_id.toLowerCase() === id);
  if (peer === undefined) {
    return "Not connected to this peer. Connect to it in the Peers card first.";
  }
  return peer.is_connected ? null : "This peer is disconnected. Reconnect to it in the Peers card first.";
}

// === Addresses and peers

const BECH32 = /^(bc1|tb1|bcrt1)[02-9ac-hj-np-z]{11,87}$/;
const BASE58 = /^[123mn][1-9A-HJ-NP-Za-km-z]{25,39}$/;
const BECH32_PREFIX: Record<string, string> = { bitcoin: "bc1", testnet: "tb1", signet: "tb1", regtest: "bcrt1" };

/** Shape check only (prefix, alphabet, length); the node verifies the checksum. */
export function addressError(address: string, network: string | null): string | null {
  const trimmed = address.trim();
  if (trimmed === "") {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (BECH32.test(lower)) {
    const prefix = network === null ? undefined : BECH32_PREFIX[network];
    if (prefix !== undefined && !lower.startsWith(prefix)) {
      return `This address is for a different network. The node runs on ${network}.`;
    }
    return null;
  }
  if (BASE58.test(trimmed)) {
    const mainnet = trimmed.startsWith("1") || trimmed.startsWith("3");
    if (network !== null && mainnet !== (network === "bitcoin")) {
      return `This address is for a different network. The node runs on ${network}.`;
    }
    return null;
  }
  return "Not a valid Bitcoin address.";
}

export function nodeIdError(nodeId: string): string | null {
  return nodeId.trim() === "" || isValidPubkey(nodeId.trim()) ? null : "A node id is 66 hex characters starting with 02 or 03.";
}

/** `host:port` with a port from 1 to 65535. */
export function hostPortError(address: string): string | null {
  const trimmed = address.trim();
  if (trimmed === "") {
    return null;
  }
  const match = /^[A-Za-z0-9.-]+:(\d{1,5})$/.exec(trimmed);
  const port = match === null ? 0 : Number(match[1]);
  return port >= 1 && port <= 65535 ? null : "Use the form host:port, for example 127.0.0.1:9735.";
}

// === Invoices

export function expiryError(input: string): string | null {
  const value = satValue(input);
  if (value === null || value === BigInt(0)) {
    return "Enter a whole number of seconds, above 0.";
  }
  return value > BigInt(MAX_EXPIRY_SECS) ? "At most one year (31,536,000 seconds)." : null;
}

export function descriptionError(description: string): string | null {
  return new TextEncoder().encode(description).length > MAX_DESCRIPTION_LEN
    ? `Too long. BOLT11 allows ${MAX_DESCRIPTION_LEN} bytes.`
    : null;
}

/** Receive amount: optional, but a given amount must be above 0. */
export function invoiceAmountError(input: string): string | null {
  return satAmountError(input, 1, null);
}
