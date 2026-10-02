import { describe, expect, it } from "vitest";

import {
  amountParts,
  formatBtc,
  formatDuration,
  formatLocalTime,
  formatUnixUtc,
  MIN_ONCHAIN_SAT,
  networkName,
  onchainAmountError,
  shortHex,
} from "@/lib/format";

describe("amountParts", () => {
  it("converts without floating point error", () => {
    expect(amountParts("250000000")).toEqual({ msat: "250,000,000", sat: "250000", btc: "0.0025" });
    expect(amountParts("967878534")).toEqual({ msat: "967,878,534", sat: "967878.534", btc: "0.00967878534" });
  });

  it("handles amounts above 2^53 msat exactly", () => {
    expect(amountParts("2100000000000000000").btc).toBe("21000000");
    expect(amountParts("9007199254740993").sat).toBe("9007199254740.993");
  });
});

describe("formatting helpers", () => {
  it("formats durations with two units at most", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(3661)).toBe("1h 1m");
    expect(formatDuration(604_800)).toBe("7d");
  });

  it("formats unix time in UTC", () => {
    expect(formatUnixUtc(1_496_314_658)).toBe("2017-06-01 10:57:38 UTC");
  });

  it("shortens long hex and names networks", () => {
    expect(shortHex("03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad")).toBe(
      "03e7156ae3...0f934dd9ad",
    );
    expect(networkName("bitcoin")).toBe("mainnet");
  });
});

describe("sat helpers", () => {
  it("formats sat and msat with separators", async () => {
    const { formatMsat, formatSat } = await import("@/lib/format");
    expect(formatSat("1000000")).toBe("1,000,000 sat");
    expect(formatMsat("1500")).toBe("1.5 sat");
    expect(formatMsat("50000000")).toBe("50,000 sat");
  });

  it("turns whole-sat input into msat without floating point", async () => {
    const { satInputToMsat } = await import("@/lib/format");
    expect(satInputToMsat(" 21 ")).toBe("21000");
    expect(satInputToMsat("9007199254740993")).toBe("9007199254740993000");
    expect(satInputToMsat("1.5")).toBeNull();
    expect(satInputToMsat("")).toBeNull();
  });
});

describe("onchainAmountError", () => {
  it("is quiet for empty input and amounts at or above the dust limit", () => {
    expect(onchainAmountError("")).toBeNull();
    expect(onchainAmountError(String(MIN_ONCHAIN_SAT))).toBeNull();
    expect(onchainAmountError("100000")).toBeNull();
  });

  it("flags dust and non-numeric input", () => {
    expect(onchainAmountError("22")).toContain("dust limit");
    expect(onchainAmountError("329")).toContain("dust limit");
    expect(onchainAmountError("1.5")).toContain("whole number");
    expect(onchainAmountError("abc")).toContain("whole number");
  });
});

describe("formatLocalTime", () => {
  it("formats local date and time with zero padding", () => {
    expect(formatLocalTime(new Date(2026, 9, 1, 5, 4, 3).getTime())).toBe("2026-10-01 05:04:03");
  });
});

describe("formatBtc", () => {
  it("shows eight decimals and stays exact for huge values", () => {
    expect(formatBtc("99963328")).toBe("0.99963328 BTC");
    expect(formatBtc("100000000")).toBe("1.00000000 BTC");
    expect(formatBtc("0")).toBe("0.00000000 BTC");
    expect(formatBtc("9007199254740993")).toBe("90,071,992.54740993 BTC");
  });
});
