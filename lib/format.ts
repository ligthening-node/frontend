import type { Network } from "@/lib/types/Network";

const MSAT_PER_SAT = BigInt(1_000);
const MSAT_PER_BTC = BigInt(100_000_000_000);

/** Integer division as a decimal string without trailing zeros, e.g. (250000000n, 1000n) -> "250000". */
function divideToDecimal(value: bigint, divisor: bigint, digits: number): string {
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(digits, "0").replace(/0+$/, "");
  return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}

export interface AmountParts {
  msat: string;
  sat: string;
  btc: string;
}

/** Converts a millisatoshi string (as the decoder emits it) to msat, sat and BTC without floating point. */
export function amountParts(msat: string): AmountParts {
  const value = BigInt(msat);
  return {
    msat: value.toLocaleString("en-US"),
    sat: divideToDecimal(value, MSAT_PER_SAT, 3),
    btc: divideToDecimal(value, MSAT_PER_BTC, 11),
  };
}

export function formatUnixUtc(unix: number): string {
  return new Date(unix * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

const UNITS: ReadonlyArray<[number, string]> = [
  [365 * 86_400, "y"],
  [86_400, "d"],
  [3_600, "h"],
  [60, "m"],
  [1, "s"],
];

/** Formats seconds as at most two units, e.g. 3661 -> "1h 1m". */
export function formatDuration(totalSecs: number): string {
  let rest = totalSecs;
  const parts: string[] = [];
  for (const [size, unit] of UNITS) {
    if (rest >= size) {
      parts.push(`${Math.floor(rest / size)}${unit}`);
      rest %= size;
    }
    if (parts.length === 2) {
      break;
    }
  }
  return parts.length === 0 ? "0s" : parts.join(" ");
}

/** Pubkeys and hashes are long; show the ends so they stay recognizable. */
export function shortHex(hex: string, keep: number = 10): string {
  return hex.length <= keep * 2 + 3 ? hex : `${hex.slice(0, keep)}...${hex.slice(-keep)}`;
}

const NETWORK_NAMES: Record<Network, string> = {
  bitcoin: "mainnet",
  testnet: "testnet",
  signet: "signet",
  regtest: "regtest",
};

export function networkName(network: Network): string {
  return NETWORK_NAMES[network];
}

/** Formats a satoshi string with thousands separators, e.g. "1000000" -> "1,000,000 sat". */
export function formatSat(sat: string): string {
  return `${BigInt(sat).toLocaleString("en-US")} sat`;
}

/** Whole BTC with 8 decimals from a satoshi string, exact for any size: "99963328" -> "0.99963328 BTC". */
export function formatBtc(sat: string): string {
  const value = BigInt(sat);
  const whole = value / BigInt(100_000_000);
  const fraction = (value % BigInt(100_000_000)).toString().padStart(8, "0");
  return `${whole.toLocaleString("en-US")}.${fraction} BTC`;
}

/** Formats a millisatoshi string in sat, keeping any fraction, e.g. "1500" -> "1.5 sat". */
export function formatMsat(msat: string): string {
  const { sat } = amountParts(msat);
  const [whole, fraction] = sat.split(".");
  const grouped = BigInt(whole).toLocaleString("en-US");
  return fraction === undefined ? `${grouped} sat` : `${grouped}.${fraction} sat`;
}

const SAT_PATTERN = /^\d+$/;

/** Converts a whole-sat input to msat without floating point. Returns null for anything else. */
export function satInputToMsat(input: string): string | null {
  const trimmed = input.trim();
  if (!SAT_PATTERN.test(trimmed)) {
    return null;
  }
  return (BigInt(trimmed) * MSAT_PER_SAT).toString();
}

// === On-chain amounts and times

/** Smallest output standard segwit and taproot nodes relay (P2WSH and P2TR dust is 330 sat). */
export const MIN_ONCHAIN_SAT = 330;

/** Why a whole-sat on-chain amount cannot be sent, or null when it is fine. Empty input is not an error yet. */
export function onchainAmountError(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") {
    return null;
  }
  if (!SAT_PATTERN.test(trimmed)) {
    return "Enter a whole number of sats.";
  }
  if (BigInt(trimmed) < BigInt(MIN_ONCHAIN_SAT)) {
    return `Below the dust limit. Send at least ${MIN_ONCHAIN_SAT} sat or the network rejects the output.`;
  }
  return null;
}

/** Local wall-clock time with the date, e.g. "2026-10-01 15:09:16", for events and just-sent transactions. */
export function formatLocalTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
