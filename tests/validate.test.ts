import { describe, expect, it } from "vitest";

import type { PeerView } from "@/lib/types/PeerView";
import {
  addressError,
  channelCapacityError,
  descriptionError,
  expiryError,
  hostPortError,
  invoiceAmountError,
  nodeIdError,
  onchainSendError,
  peerConnectionError,
  pushError,
} from "@/lib/validate";

const PUBKEY = `02${"ab".repeat(32)}`;

describe("onchainSendError", () => {
  it("flags dust, junk and amounts above the spendable balance", () => {
    expect(onchainSendError("22", "1000000")).toContain("dust limit");
    expect(onchainSendError("1.5", "1000000")).toContain("whole number");
    expect(onchainSendError("2000000", "1000000")).toContain("1,000,000 sat available");
    expect(onchainSendError("100000", "1000000")).toBeNull();
    expect(onchainSendError("", "1000000")).toBeNull();
    expect(onchainSendError("100000", null)).toBeNull();
  });
});

describe("addressError", () => {
  const regtest = "bcrt1q4d2mks6ahy6dsrm2kspua5vvc0jxkm6y69thf6";
  it("accepts a matching address and rejects junk", () => {
    expect(addressError(regtest, "regtest")).toBeNull();
    expect(addressError(regtest, null)).toBeNull();
    expect(addressError("hello", "regtest")).toContain("Not a valid");
    expect(addressError("", "regtest")).toBeNull();
  });

  it("rejects an address for another network", () => {
    expect(addressError("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "regtest")).toContain("different network");
    expect(addressError(regtest, "bitcoin")).toContain("different network");
    expect(addressError("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn", "bitcoin")).toContain("different network");
  });
});

describe("channel forms", () => {
  it("checks capacity, push, node id and host:port", () => {
    expect(channelCapacityError("100", "1000000")).toContain("at least 500");
    expect(channelCapacityError("500", "1000000")).toBeNull();
    expect(channelCapacityError("5000", "1000000")).toBeNull();
    expect(channelCapacityError("5000000", "1000000")).toContain("available");
    expect(channelCapacityError("500000", "1000000")).toBeNull();
    expect(pushError("500000", "500000")).toContain("smaller");
    expect(pushError("100", "500000")).toBeNull();
    expect(pushError("", "500000")).toBeNull();
    expect(pushError("4600", "5000")).toContain("at least 500");
    expect(pushError("4500", "5000")).toBeNull();
    expect(nodeIdError("039355eb")).not.toBeNull();
    expect(nodeIdError(PUBKEY)).toBeNull();
    expect(hostPortError("127.0.0.1")).not.toBeNull();
    expect(hostPortError("127.0.0.1:99999")).not.toBeNull();
    expect(hostPortError("127.0.0.1:9735")).toBeNull();
  });
});

describe("invoice form", () => {
  it("checks amount, expiry and description length", () => {
    expect(invoiceAmountError("0")).toContain("at least 1");
    expect(invoiceAmountError("")).toBeNull();
    expect(expiryError("0")).not.toBeNull();
    expect(expiryError("3600")).toBeNull();
    expect(expiryError("99999999999")).toContain("one year");
    expect(descriptionError("a".repeat(640))).toContain("639");
    expect(descriptionError("book")).toBeNull();
  });
});

describe("peerConnectionError", () => {
  const peer = (is_connected: boolean): PeerView => ({
    node_id: PUBKEY,
    address: "127.0.0.1:9736",
    is_connected,
    is_persisted: true,
  });

  it("lets a channel open only with a peer that is connected right now", () => {
    expect(peerConnectionError(PUBKEY, [peer(true)])).toBeNull();
    expect(peerConnectionError(PUBKEY.toUpperCase(), [peer(true)])).toBeNull();
    expect(peerConnectionError(`  ${PUBKEY}  `, [peer(true)])).toBeNull();
  });

  it("refuses a peer that was never connected", () => {
    expect(peerConnectionError(PUBKEY, [])).toContain("Not connected to this peer");
    expect(peerConnectionError(`03${"cd".repeat(32)}`, [peer(true)])).toContain("Not connected to this peer");
  });

  it("refuses a peer that is listed but disconnected", () => {
    expect(peerConnectionError(PUBKEY, [peer(false)])).toContain("disconnected");
  });

  it("stays quiet while the id is empty or malformed, since those have their own messages", () => {
    expect(peerConnectionError("", [])).toBeNull();
    expect(peerConnectionError("039355eb", [])).toBeNull();
  });
});
