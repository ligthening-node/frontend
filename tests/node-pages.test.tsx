import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dashboard } from "@/components/node/dashboard";
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
