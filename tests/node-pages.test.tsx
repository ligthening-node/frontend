import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dashboard } from "@/components/node/dashboard";
import { Send, channelSetupProblem } from "@/components/node/send";
import { Wallet } from "@/components/node/wallet";

const STATUS = {
  node_id: "02abc",
  network: "regtest",
  is_running: true,
  block_height: 101,
  best_block_hash: "00",
  is_synced: true,
  last_onchain_sync: 1700000000,
  last_lightning_sync: 1700000000,
  listening_addresses: ["127.0.0.1:9735"],
};
const BALANCES = {
  onchain_total_sat: "9007199254740993",
  onchain_spendable_sat: "1000",
  anchor_reserve_sat: "0",
  lightning_sat: "0",
};

function stubApi(routes: Record<string, unknown>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string): Promise<Response> => {
      const key = url.replace("/api/", "");
      if (key in routes) {
        return Response.json(routes[key]);
      }
      return Response.json({ error: { code: "node_unreachable", message: "the node API is not reachable" } }, { status: 502 });
    }),
  );
}

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe("Dashboard", () => {
  it("shows status and exact balances", async () => {
    stubApi({ "node/status": STATUS, "wallet/balance": BALANCES });
    render(<Dashboard />);
    expect(await screen.findByText("Synced")).toBeInTheDocument();
    expect(screen.getByText("101")).toBeInTheDocument();
    // The same exact figure is the total and the on-chain balance, so it shows more than once.
    expect(screen.getByTestId("total-balance")).toHaveTextContent("9,007,199,254,740,993 sat");
    expect(screen.getAllByText("9,007,199,254,740,993 sat").length).toBeGreaterThan(1);
  });

  it("explains when the node is offline", async () => {
    stubApi({});
    render(<Dashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The node is offline");
  });
});

describe("Wallet", () => {
  it("shows a new address after the button is pressed", async () => {
    stubApi({ "wallet/balance": BALANCES, "wallet/address": { address: "bcrt1qexample" } });
    render(<Wallet />);
    fireEvent.click(screen.getByRole("button", { name: "New address" }));
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("bcrt1qexample"));
  });
});

describe("Send without a channel", () => {
  // A pasted regtest invoice. The page must warn about the missing channel whatever the decoder says.
  const INVOICE =
    "lnbcrt10u1p4vqgd0dq9vdshynp4q2gen3nu9rd48uklc08wsur872d34whjkfljsgggtxxze63gmlrw5pp5w2p02r7w6tdrj5s7439wa5j7msze8j3qctfjscdqzfq9efdxwx6ssp50j9cgm9scmrwcqncus96kpznps4cpm79rjhfrwn06u6sdjecqzaq9qyysgqcqzp2xqrrssrzjqwzwz2nzj6tww3lfthqgmz2h6t4suulp06rjj6urmytntnyxd4gazqqqqyqq0ugqqqqqqqlgqqqqqqqqfqjlldszfa8etw67pl60s4frq5dc6mkgg94ecf005hr897jrcwrsqs0qyhfdszcyfccypmlnmqsk2h5hz5azvpqrzm9gusd55y6zwa6rhq";
  const channel = (is_usable: boolean): object => ({
    channel_id: "aa",
    user_channel_id: "1",
    counterparty_node_id: "02ab",
    funding_txo: null,
    short_channel_id: null,
    capacity_sat: "20000",
    outbound_msat: "18340000",
    inbound_msat: "0",
    max_send_msat: "17969000",
    is_outbound: true,
    is_channel_ready: is_usable,
    is_usable,
    confirmations: 6,
    confirmations_required: 6,
    our_balance_sat: "19056",
    our_reserve_sat: "1000",
    their_reserve_sat: "1000",
  });

  async function paste(): Promise<void> {
    fireEvent.change(await screen.findByLabelText("BOLT11 invoice"), { target: { value: INVOICE } });
  }

  /** Waits until the channel list has been fetched and rendered, so "no warning" is not just "not loaded yet". */
  async function channelsLoaded(): Promise<void> {
    const fetchMock = vi.mocked(fetch);
    await waitFor((): void => {
      expect(fetchMock.mock.calls.some((call): boolean => call[0] === "/api/channels")).toBe(true);
    });
    await new Promise((resolve): void => {
      setTimeout(resolve, 50);
    });
  }

  it("tells you to create a channel as soon as an invoice is pasted", async () => {
    stubApi({ "node/status": STATUS, channels: [] });
    render(<Send />);
    await paste();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Create a channel first");
    expect(alert).toHaveTextContent("You have no channel yet");
    expect(screen.getByRole("link", { name: "Go to Channels" })).toHaveAttribute("href", "/channels");
  });

  it("stays quiet before anything is pasted", async () => {
    stubApi({ "node/status": STATUS, channels: [] });
    render(<Send />);
    await screen.findByLabelText("BOLT11 invoice");
    await channelsLoaded();
    expect(screen.queryByText("Create a channel first")).not.toBeInTheDocument();
  });

  it("explains a channel that is not usable yet", async () => {
    stubApi({ "node/status": STATUS, channels: [channel(false)] });
    render(<Send />);
    await paste();
    expect(await screen.findByRole("alert")).toHaveTextContent("None of your channels is usable yet");
  });

  it("shows no channel warning when a channel is usable", async () => {
    stubApi({ "node/status": STATUS, channels: [channel(true)] });
    render(<Send />);
    await paste();
    await channelsLoaded();
    expect(screen.queryByText("Create a channel first")).not.toBeInTheDocument();
  });
});

describe("channelSetupProblem", () => {
  const usable = { is_usable: true } as never;
  const waiting = { is_usable: false } as never;

  it("is quiet while the channels are unknown or at least one is usable", () => {
    expect(channelSetupProblem(null)).toBeNull();
    expect(channelSetupProblem([usable])).toBeNull();
    expect(channelSetupProblem([waiting, usable])).toBeNull();
  });

  it("asks for a channel when there is none, and for patience when none is usable", () => {
    expect(channelSetupProblem([])).toContain("no channel yet");
    expect(channelSetupProblem([waiting])).toContain("None of your channels is usable");
  });
});
