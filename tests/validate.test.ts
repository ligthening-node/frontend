import { describe, expect, it } from "vitest";

import {
  addressError,
  channelCapacityError,
  descriptionError,
  expiryError,
  hostPortError,
  invoiceAmountError,
  nodeIdError,
  onchainSendError,
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
