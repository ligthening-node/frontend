import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ChannelRow, channelState } from "@/components/node/channels";
import { balancePercent, localPercent } from "@/components/node/liquidity-bar";
import { describeEvent } from "@/components/node/live-events";
import { Payments } from "@/components/node/payments";
import { PayReview } from "@/components/node/send";
import { decode, initSync } from "@/lib/invoice-wasm/invoice_wasm";
import { parseNodeEvent } from "@/lib/node-events";
import { SAMPLE_INVOICES } from "@/lib/samples";
import type { ChannelView } from "@/lib/types/ChannelView";
import type { DecodeResult } from "@/lib/types/DecodeResult";
import type { Decoded } from "@/lib/types/Decoded";

const SPEC_NOW = 1_496_314_658;

const CHANNEL: ChannelView = {
  channel_id: "aa".repeat(32),
  user_channel_id: "42",
  counterparty_node_id: "03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad",
  funding_txo: "ff".repeat(32) + ":0",
  short_channel_id: "101x1x0",
  capacity_sat: "1000000",
  outbound_msat: "750000000",
  inbound_msat: "250000000",
  max_send_msat: "100000000",
  is_outbound: true,
  is_channel_ready: true,
  is_usable: true,
  confirmations: 6,
  confirmations_required: 6,
  our_balance_sat: "900000",
  our_reserve_sat: "10000",
  their_reserve_sat: "10000",
};

type FetchMock = ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

function stubFetch(handler: (url: string, init?: RequestInit) => Response): FetchMock {
  const mock = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => handler(url, init));
  vi.stubGlobal("fetch", mock);
  return mock;
}

function decodeAtSpecTime(label: string, ctx: object = {}): Decoded {
  const sample = SAMPLE_INVOICES.find((s) => s.label === label);
  if (sample === undefined) {
    throw new Error(`no sample ${label}`);
  }
  const result = JSON.parse(decode(sample.invoice, JSON.stringify({ now_unix: SPEC_NOW, ...ctx }))) as DecodeResult;
  if (result.status !== "ok") {
    throw new Error("sample should decode");
  }
  return result.decoded;
}

beforeAll((): void => {
  // jsdom gives import.meta.url an http scheme, so resolve from the package root instead.
  initSync({ module: readFileSync(join(process.cwd(), "lib/invoice-wasm/invoice_wasm_bg.wasm")) });
});

afterEach((): void => {
  vi.unstubAllGlobals();
});

// === Channels

describe("channels", () => {
  it("splits liquidity exactly, even beyond 2^53", () => {
    expect(localPercent("750000000", "250000000")).toBe(75);
    expect(localPercent("0", "0")).toBe(0);
    expect(localPercent("9007199254740993000", "0")).toBe(100);
  });

  it("starts the range bar at 100% and lowers it as sats move to the other side", () => {
    // A new 20,000 sat channel: 17,340 sat spendable, nothing receivable yet.
    expect(balancePercent("17340000", "0")).toBe(100);
    // Half of the spendable amount has moved over.
    expect(balancePercent("8670000", "8670000")).toBe(50);
    expect(balancePercent("4335000", "13005000")).toBe(25);
    expect(balancePercent("0", "17340000")).toBe(0);
    expect(balancePercent("0", "0")).toBe(0);
    // The last few hundred sat of the funder cannot be spent: that counts as fully used.
    expect(balancePercent("327000", "17013000")).toBe(0);
  });

  it("names the channel state", () => {
    expect(channelState(CHANNEL)).toBe("Still open");
    expect(channelState({ ...CHANNEL, outbound_msat: "0" })).toBe("Completed");
    expect(channelState({ ...CHANNEL, outbound_msat: "327000" })).toBe("Completed");
    expect(channelState({ ...CHANNEL, outbound_msat: "1500000" })).toBe("Still open");
    expect(channelState({ ...CHANNEL, is_outbound: false, inbound_msat: "0" })).toBe("Completed");
    expect(channelState({ ...CHANNEL, is_outbound: false, outbound_msat: "0" })).toBe("Still open");
    expect(channelState({ ...CHANNEL, is_usable: false, is_channel_ready: false, confirmations: 2 })).toBe(
      "Confirming 2/6",
    );
    expect(channelState({ ...CHANNEL, is_usable: false })).toBe("Peer offline");
  });

  it("asks before force closing, then sends force: true", async () => {
    const fetchMock = stubFetch((): Response => Response.json({ ok: true }));
    const onClosed = vi.fn();
    render(<ChannelRow channel={CHANNEL} onClosed={onClosed} />);

    fireEvent.click(screen.getByRole("button", { name: "Force close" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("locked for the dispute period");

    fireEvent.click(screen.getByRole("button", { name: "Yes, force close" }));
    await waitFor((): void => expect(onClosed).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/channels/close");
    expect(JSON.parse(String(init?.body))).toEqual({
      user_channel_id: "42",
      counterparty_node_id: CHANNEL.counterparty_node_id,
      force: true,
    });
  });

  it("shows the largest single payment next to the liquidity bar", () => {
    render(<ChannelRow channel={CHANNEL} onClosed={(): void => {}} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByText("100,000 sat")).toBeInTheDocument();
  });
});

// === Send

describe("PayReview", () => {
  it("pays a payable invoice only after confirmation", async () => {
    const fetchMock = stubFetch((): Response => Response.json({ payment_id: "ab".repeat(32) }));
    const onSent = vi.fn();
    const decoded = decodeAtSpecTime("Coffee, 1 minute expiry");
    render(<PayReview decoded={decoded} evaluatedAt={SPEC_NOW} invoice="lnbc..." expectedPayee={null} onSent={onSent} />);

    fireEvent.click(screen.getByRole("button", { name: "Review payment" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("250,000 sat");
    fireEvent.click(screen.getByRole("button", { name: "Yes, pay" }));

    await waitFor((): void => expect(onSent).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      invoice: "lnbc...",
      amount_msat: null,
      expected_payee: null,
    });
  });

  it("will not review an invoice the decoder rejects", () => {
    const decoded = decodeAtSpecTime("Coffee, 1 minute expiry", { expected_network: "regtest" });
    render(<PayReview decoded={decoded} evaluatedAt={SPEC_NOW} invoice="x" expectedPayee={null} onSent={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Review payment" })).toBeDisabled();
  });

  it("needs an amount for any-amount invoices and sends it in msat", async () => {
    const fetchMock = stubFetch((): Response => Response.json({ payment_id: "cd" }));
    const decoded = decodeAtSpecTime("Donation, any amount");
    render(<PayReview decoded={decoded} evaluatedAt={SPEC_NOW} invoice="x" expectedPayee={null} onSent={vi.fn()} />);

    const review = screen.getByRole("button", { name: "Review payment" });
    expect(review).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Amount to send (sat)"), { target: { value: "21" } });
    fireEvent.click(review);
    fireEvent.click(screen.getByRole("button", { name: "Yes, pay" }));

    await waitFor((): void => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).amount_msat).toBe("21000");
  });

  it("shows the server's report when it refuses", async () => {
    stubFetch(
      (): Response =>
        Response.json(
          {
            error: {
              code: "payment_refused",
              message: "refused to pay: Invoice is for bitcoin, but regtest was expected",
              details: { verdict: "not_payable", checks: [{ id: "network", status: "fail", message: "Wrong network" }] },
            },
          },
          { status: 422 },
        ),
    );
    const decoded = decodeAtSpecTime("Coffee, 1 minute expiry");
    render(<PayReview decoded={decoded} evaluatedAt={SPEC_NOW} invoice="x" expectedPayee={null} onSent={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Review payment" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, pay" }));

    expect(await screen.findByText("Wrong network")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("refused to pay");
  });
});

// === Payments and events

describe("Payments", () => {
  it("lists payments with signed amounts", async () => {
    stubFetch(
      (): Response =>
        Response.json([
          {
            id: "01",
            kind: "bolt11",
            direction: "inbound",
            status: "succeeded",
            amount_msat: "50000000",
            fee_paid_msat: null,
            payment_hash: "ab".repeat(32),
            preimage: null,
            txid: null,
            updated_at: SPEC_NOW,
          },
          {
            id: "02",
            kind: "onchain",
            direction: "outbound",
            status: "pending",
            amount_msat: "1500",
            fee_paid_msat: "1000",
            payment_hash: null,
            preimage: null,
            txid: "cd".repeat(32),
            updated_at: SPEC_NOW,
          },
        ]),
    );
    render(<Payments />);
    const rows = await screen.findAllByTestId("payment");
    expect(rows[0]).toHaveTextContent("+50,000 sat");
    expect(rows[0]).toHaveTextContent("Lightning");
    expect(rows[1]).toHaveTextContent("-1.5 sat");
    expect(rows[1]).toHaveTextContent("On-chain");
  });
});

describe("channel reserve", () => {
  it("shows our balance and both reserves", () => {
    render(<ChannelRow channel={CHANNEL} onClosed={(): void => {}} />);
    expect(screen.getByTestId("our-balance")).toHaveTextContent("900,000 sat");
    expect(screen.getByTestId("reserve")).toHaveTextContent("You keep 10,000 sat, they keep 10,000 sat");
  });

  it("says so when the channel is not confirmed yet", () => {
    render(<ChannelRow channel={{ ...CHANNEL, our_balance_sat: null, our_reserve_sat: null }} onClosed={(): void => {}} />);
    expect(screen.getByTestId("our-balance")).toHaveTextContent("not confirmed yet");
    expect(screen.getByTestId("reserve")).toHaveTextContent("You keep ?");
  });
});

describe("live events", () => {
  it("parses SSE frames and ignores junk", () => {
    expect(parseNodeEvent('{"kind":"payment_received","payment_hash":"ab","amount_msat":"21000"}')).toEqual({
      kind: "payment_received",
      payment_hash: "ab",
      amount_msat: "21000",
    });
    expect(parseNodeEvent('{"kind":"payments_changed"}')).toEqual({ kind: "payments_changed" });
    expect(parseNodeEvent("not json")).toBeNull();
    expect(parseNodeEvent('{"no":"kind"}')).toBeNull();
  });

  it("describes events for people", () => {
    expect(describeEvent({ kind: "payment_received", payment_hash: "ab", amount_msat: "21000" })).toBe(
      "Received 21 sat",
    );
    expect(describeEvent({ kind: "payments_changed" })).toBe("Payments updated");
    expect(describeEvent({ kind: "channel_closed", channel_id: "aa", reason: null })).toBe("Channel closed");
  });
});
