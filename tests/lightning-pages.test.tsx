import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ChannelRow, channelState, sortChannels } from "@/components/node/channels";
import {
  channelTotalMsat,
  spendableMsat,
  spendableTotalMsat,
  transactionProgress,
} from "@/components/node/channel-allowance";
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
  it("makes the total allowed equal the channel capacity, whatever has been paid", () => {
    const channel = { ...CHANNEL, capacity_sat: "20000" };
    expect(channelTotalMsat(channel)).toBe(BigInt("20000000"));
    expect(channelTotalMsat({ ...channel, outbound_msat: "0", inbound_msat: "17340000" })).toBe(BigInt("20000000"));
    expect(channelTotalMsat({ ...CHANNEL, capacity_sat: "1000000" })).toBe(BigInt("1000000000"));
    expect(channelTotalMsat({ ...CHANNEL, capacity_sat: "9007199254740993" })).toBe(BigInt("9007199254740993000"));
  });

  it("works out what can really move (capacity minus anchors and the funder's reserve) for the leftover limit", () => {
    expect(spendableTotalMsat("1000000", "10000", "964340000", "15000000")).toBe(BigInt("989340000"));
    expect(spendableTotalMsat("20000", "1000", "0", "17340000")).toBe(BigInt("18340000"));
    // Without a known reserve it falls back to the sum of both sides.
    expect(spendableTotalMsat("20000", null, "8000000", "9000000")).toBe(BigInt("17000000"));
  });

  it("counts the funder's unspendable leftover as zero, up to 3,000 sat or half a tiny channel", () => {
    const total = BigInt("98340000");
    expect(spendableMsat("17340000", total)).toBe(BigInt("17340000"));
    expect(spendableMsat("3000000", total)).toBe(BigInt("3000000"));
    // What was left on a real channel after the last payment: 2,557 sat, 2,257 sat, 371 sat.
    expect(spendableMsat("2557000", total)).toBe(BigInt(0));
    expect(spendableMsat("2257000", total)).toBe(BigInt(0));
    expect(spendableMsat("371000", total)).toBe(BigInt(0));
    expect(spendableMsat("0", total)).toBe(BigInt(0));
    // A 3,000 sat channel can only move 1,340 sat, so the limit is half of that.
    expect(spendableMsat("700000", BigInt("1340000"))).toBe(BigInt("700000"));
    expect(spendableMsat("600000", BigInt("1340000"))).toBe(BigInt(0));
  });

  it("starts with left to transact equal to the capacity and counts it down to 0 as sats move", () => {
    // The user's example: a 20,000 sat channel. 10,000 sat paid is exactly half.
    const base = { ...CHANNEL, capacity_sat: "20000", our_reserve_sat: "1000", their_reserve_sat: "1000" };
    const fresh = { ...base, outbound_msat: "18340000", inbound_msat: "0" };
    const p = (c: typeof base): [string, string, string] => {
      const r = transactionProgress(c);
      return [r.total.toString(), r.transacted.toString(), r.left.toString()];
    };
    expect(p(fresh)).toEqual(["20000000", "0", "20000000"]);
    expect(p({ ...base, outbound_msat: "8340000", inbound_msat: "9000000" })).toEqual(["20000000", "10000000", "10000000"]);
    // The other node reads the same numbers from its own side.
    const peerSide = { ...base, is_outbound: false, outbound_msat: "9000000", inbound_msat: "8340000" };
    expect(p(peerSide)).toEqual(["20000000", "10000000", "10000000"]);
    // Paying some back raises "left" again.
    expect(p({ ...base, outbound_msat: "13340000", inbound_msat: "4000000" })).toEqual(["20000000", "5000000", "15000000"]);
    // Used up: only the held-back leftover remains, so everything counts as transacted.
    expect(p({ ...base, outbound_msat: "371000", inbound_msat: "16969000" })).toEqual(["20000000", "20000000", "0"]);
    expect(p({ ...peerSide, inbound_msat: "371000", outbound_msat: "16969000" })).toEqual(["20000000", "20000000", "0"]);
  });

  it("shows the capacity as the total and as left to transact on a new channel, then counts down", () => {
    const channel = {
      ...CHANNEL,
      capacity_sat: "1000000",
      our_reserve_sat: "10000",
      their_reserve_sat: "10000",
      outbound_msat: "989340000",
      inbound_msat: "0",
    };
    const { rerender } = render(<ChannelRow channel={channel} onClosed={(): void => {}} />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    const box = (): HTMLElement => screen.getByTestId("channel-allowance");
    expect(box()).toHaveTextContent("Capacity1,000,000 sat");
    expect(box()).toHaveTextContent("Transacted so far0 sat");
    expect(box()).toHaveTextContent("Left to transact1,000,000 sat");
    expect(box()).toHaveTextContent("Left to send989,340 sat");
    expect(screen.getByText("Still open")).toBeInTheDocument();

    // 25,000 sat paid: the total stays, transacted grows, left falls.
    rerender(<ChannelRow channel={{ ...channel, outbound_msat: "964340000", inbound_msat: "15000000" }} onClosed={(): void => {}} />);
    expect(box()).toHaveTextContent("Capacity1,000,000 sat");
    expect(box()).toHaveTextContent("Transacted so far25,000 sat");
    expect(box()).toHaveTextContent("Left to transact975,000 sat");
    expect(box()).toHaveTextContent("Left to receive15,000 sat");

    // Used up: left to transact is exactly 0 and the channel is completed.
    rerender(<ChannelRow channel={{ ...channel, outbound_msat: "371000", inbound_msat: "978969000" }} onClosed={(): void => {}} />);
    expect(box()).toHaveTextContent("Capacity1,000,000 sat");
    expect(box()).toHaveTextContent("Transacted so far1,000,000 sat");
    expect(box()).toHaveTextContent("Left to transact0 sat");
    expect(box()).toHaveTextContent("Left to send0 sat");
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("keeps channels in a fixed order, oldest first, when a new one appears", () => {
    const old = { ...CHANNEL, channel_id: "bb", user_channel_id: "1", confirmations: 40 };
    const mid = { ...CHANNEL, channel_id: "aa", user_channel_id: "2", confirmations: 12 };
    const pending = { ...CHANNEL, channel_id: "cc", user_channel_id: "3", confirmations: null };
    const ids = (list: (typeof CHANNEL)[]): string[] => sortChannels(list).map((c): string => c.user_channel_id);
    expect(ids([pending, mid, old])).toEqual(["1", "2", "3"]);
    expect(ids([old, pending, mid])).toEqual(["1", "2", "3"]);
    // Same age: the channel id breaks the tie, so the order never depends on what the node returned.
    const twin = { ...mid, channel_id: "ab", user_channel_id: "4" };
    expect(ids([twin, mid])).toEqual(ids([mid, twin]));
  });

  it("names the channel state", () => {
    expect(channelState(CHANNEL)).toBe("Still open");
    expect(channelState({ ...CHANNEL, outbound_msat: "0" })).toBe("Completed");
    expect(channelState({ ...CHANNEL, outbound_msat: "327000" })).toBe("Completed");
    expect(channelState({ ...CHANNEL, outbound_msat: "2557000" })).toBe("Completed");
    expect(channelState({ ...CHANNEL, outbound_msat: "3500000" })).toBe("Still open");
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

  it("shows the largest single payment next to the allowance", () => {
    render(<ChannelRow channel={CHANNEL} onClosed={(): void => {}} />);
    expect(screen.getByTestId("channel-allowance")).toBeInTheDocument();
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
    expect(describeEvent({ kind: "channel_closed", channel_id: "aa", reason: "peer went away" })).toBe(
      "Channel closed: peer went away",
    );
    // The error the peer sends for a channel that is too small becomes advice.
    const tooSmall = describeEvent({
      kind: "channel_closed",
      channel_id: "aa",
      reason:
        "Channel closed because counterparty force-closed with message: Suitable channel reserve not found. remote_channel_reserve was (1000000)msats. Channel value is (1000000 - 0)msats.",
    });
    expect(tooSmall).toContain("too small");
    expect(tooSmall).toContain("at least 2,300 sat");
  });
});
