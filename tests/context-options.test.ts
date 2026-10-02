import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, toDecodeContext } from "@/components/decoder/context-options";

const PAYEE = "03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad";

describe("toDecodeContext", () => {
  it("maps empty settings to an unconstrained context", () => {
    expect(toDecodeContext(DEFAULT_SETTINGS, 42)).toEqual({
      now_unix: 42,
      expected_network: null,
      expected_payee: null,
      description_preimage: null,
      max_amount_msat: null,
    });
  });

  it("passes valid values through and normalizes the payee", () => {
    const ctx = toDecodeContext(
      { ...DEFAULT_SETTINGS, network: "regtest", expectedPayee: ` ${PAYEE.toUpperCase()} `, maxMsat: "1000" },
      1,
    );
    expect(ctx.expected_network).toBe("regtest");
    expect(ctx.expected_payee).toBe(PAYEE);
    expect(ctx.max_amount_msat).toBe("1000");
  });

  it("leaves out invalid values instead of sending them to the decoder", () => {
    const ctx = toDecodeContext({ ...DEFAULT_SETTINGS, expectedPayee: "03abc", maxMsat: "1.5" }, 1);
    expect(ctx.expected_payee).toBeNull();
    expect(ctx.max_amount_msat).toBeNull();
  });
});
