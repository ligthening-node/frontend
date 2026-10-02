// @vitest-environment node
import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { decode, initSync } from "@/lib/invoice-wasm/invoice_wasm";
import { SAMPLE_INVOICES } from "@/lib/samples";
import type { DecodeResult } from "@/lib/types/DecodeResult";

const SPEC_NOW = 1_496_314_658;

function run(invoice: string, ctx: object = { now_unix: SPEC_NOW }): DecodeResult {
  return JSON.parse(decode(invoice, JSON.stringify(ctx))) as DecodeResult;
}

function sample(label: string): string {
  const found = SAMPLE_INVOICES.find((s) => s.label === label);
  if (found === undefined) {
    throw new Error(`no sample ${label}`);
  }
  return found.invoice;
}

describe("the real WebAssembly decoder", () => {
  beforeAll((): void => {
    initSync({ module: readFileSync(new URL("../lib/invoice-wasm/invoice_wasm_bg.wasm", import.meta.url)) });
  });

  it("decodes into the generated TypeScript shape", () => {
    const result = run(sample("Coffee, 1 minute expiry"));
    if (result.status !== "ok") {
      throw new Error(`expected ok, got ${result.status}`);
    }
    const { invoice, report, anatomy } = result.decoded;
    expect(invoice.amount_msat).toBe("250000000");
    expect(invoice.description).toEqual({ kind: "direct", value: "1 cup coffee" });
    expect(invoice.payee.source).toBe("recovered");
    expect(report.verdict).toBe("payable");
    expect(anatomy.map((s) => s.raw).join("")).toBe(result.decoded.normalized);
  });

  it("classifies every sample", () => {
    const verdicts = SAMPLE_INVOICES.map((s) => {
      const r = run(s.invoice, { now_unix: s.label.startsWith("Pico") ? 1_572_468_703 : SPEC_NOW });
      return [s.label, r.status === "ok" ? r.decoded.report.verdict : r.status];
    });
    expect(Object.fromEntries(verdicts)).toMatchObject({
      "Donation, any amount": "payable",
      "Unknown required feature (not payable)": "not_payable",
      "Missing payment secret (invalid)": "invalid",
      "High-S signature with n (invalid)": "invalid",
      "Bad checksum (unreadable)": "error",
    });
  });

  it("reports structured errors and bad context", () => {
    const bad = run("lnbc1qqqqqqb");
    expect(bad.status).toBe("error");
    expect(run(sample("Donation, any amount"), { now_unix: "later" }).status).toBe("invalid_context");
  });
});
