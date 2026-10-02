import { isValidPubkey } from "@/components/decoder/context-options";
import { MIN_ONCHAIN_SAT } from "@/lib/format";

// === Limits

/**
 * Smallest channel the form accepts. The node itself needs about 3,000 sat for a channel that can
 * carry a payment (the opening fee plus the reserve each side keeps), so smaller ones may still be
 * refused by the node, which then says why.
 */
export const MIN_CHANNEL_SAT = 500;
/** What must stay on the opener's side after the push. */
export const MIN_OUR_SIDE_SAT = 500;
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
  return satAmountError(input, MIN_CHANNEL_SAT, spendableSat === null ? null : BigInt(spendableSat));
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
