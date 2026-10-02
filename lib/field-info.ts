import type { SegmentKind } from "@/lib/types/SegmentKind";

export interface FieldInfo {
  name: string;
  explanation: string;
}

/** Plain-language explanations shown next to each part of an invoice. */
export const SEGMENT_INFO: Record<Exclude<SegmentKind, "tagged_field">, FieldInfo> = {
  hrp: {
    name: "Human-readable part",
    explanation:
      "\"ln\" + the network (bc mainnet, tb testnet, tbs signet, bcrt regtest) + an optional amount in bitcoin with a multiplier: m (milli), u (micro), n (nano), p (pico).",
  },
  separator: {
    name: "Separator",
    explanation: "The last \"1\" in the string splits the readable part from the bech32 data.",
  },
  timestamp: {
    name: "Timestamp",
    explanation: "7 characters = 35 bits: when the invoice was created, in seconds since 1970.",
  },
  signature: {
    name: "Signature",
    explanation:
      "65 bytes: a 64-byte secp256k1 signature plus a recovery id. It signs SHA256 of the readable part and all data before it. Without an n field, the payee key is recovered from it.",
  },
  checksum: {
    name: "Checksum",
    explanation: "6 characters that catch typos. Change any character and the checksum fails.",
  },
};

export const TAG_INFO: Record<string, FieldInfo> = {
  p: {
    name: "Payment hash",
    explanation:
      "SHA256 of a secret preimage only the payee knows. Every HTLC along the route is locked to it, and the preimage is your proof of payment.",
  },
  s: {
    name: "Payment secret",
    explanation:
      "Sent to the payee inside the onion. Stops intermediate nodes from probing whether the payee is the final destination.",
  },
  d: {
    name: "Description",
    explanation: "A short UTF-8 note from the payee about what is being paid for.",
  },
  h: {
    name: "Description hash",
    explanation:
      "SHA256 of a description too long to include. You need the original text from elsewhere to check it.",
  },
  n: {
    name: "Payee public key",
    explanation:
      "The node id of the payee. When present, the signature must verify against it; otherwise the key is recovered from the signature.",
  },
  x: {
    name: "Expiry",
    explanation: "Seconds after the timestamp until the invoice expires. Defaults to 3600 (1 hour).",
  },
  c: {
    name: "Min final CLTV expiry",
    explanation:
      "How many blocks the final HTLC must stay locked, giving the payee time to claim it on-chain if needed. Defaults to 18.",
  },
  f: {
    name: "Fallback address",
    explanation: "An on-chain address the payer can use if the Lightning payment fails.",
  },
  r: {
    name: "Route hint",
    explanation:
      "Private channels are not in the public graph. These hops tell the payer how to reach the payee through them, with each hop's fees and CLTV delta.",
  },
  "9": {
    name: "Features",
    explanation:
      "Feature bits. Even bits are required, odd bits are optional (\"it's ok to be odd\"). An unknown required bit means you cannot pay.",
  },
  m: {
    name: "Metadata",
    explanation: "Extra bytes the payee wants back with the payment, so it does not have to store context.",
  },
};

export function tagInfo(tag: string): FieldInfo {
  return (
    TAG_INFO[tag] ?? {
      name: `Unknown field '${tag}'`,
      explanation: "Readers must skip fields they do not understand, so the format can grow.",
    }
  );
}
