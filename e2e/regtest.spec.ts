import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Drives the real docker compose stack (see README): web on :3000 and a second node behind the
// API on :3002. It funds both wallets through bitcoind's RPC and can be run again on the same stack.
//
//   LN_API_TOKEN=... docker compose up -d --build
//   E2E_REGTEST=1 LN_API_TOKEN=... pnpm exec playwright test --project=regtest

const TOKEN = process.env.LN_API_TOKEN ?? "";
const PEER_API = "http://127.0.0.1:3002";
const RPC = "http://127.0.0.1:18443";
const RPC_AUTH = "Basic " + Buffer.from("lightning:lightning").toString("base64");

test.describe.configure({ mode: "serial" });

async function rpc(page: Page, path: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await page.request.post(`${RPC}${path}`, {
    headers: { authorization: RPC_AUTH, "content-type": "text/plain" },
    data: JSON.stringify({ jsonrpc: "1.0", id: "e2e", method, params }),
  });
  const body = (await response.json()) as { result: unknown; error: unknown };
  if (body.error !== null) {
    throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  }
  return body.result;
}

async function mine(page: Page, blocks: number): Promise<void> {
  await rpc(page, "", "createwallet", ["e2e"]).catch((): void => {});
  await rpc(page, "", "loadwallet", ["e2e"]).catch((): void => {});
  const address = (await rpc(page, "/wallet/e2e", "getnewaddress", [])) as string;
  await rpc(page, "/wallet/e2e", "generatetoaddress", [blocks, address]);
}

async function peerApi<T>(page: Page, path: string, body?: object): Promise<T> {
  const headers = { authorization: `Bearer ${TOKEN}` };
  const response =
    body === undefined
      ? await page.request.get(`${PEER_API}/${path}`, { headers })
      : await page.request.post(`${PEER_API}/${path}`, { headers, data: body });
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

// Earlier runs (or a manual session) may have left channels open. Close them so this run starts
// from a known state.
async function closeLeftoverChannels(page: Page): Promise<void> {
  const list = async (): Promise<{ user_channel_id: string; counterparty_node_id: string }[]> =>
    (await (await page.request.get("/api/channels")).json()) as {
      user_channel_id: string;
      counterparty_node_id: string;
    }[];
  for (const channel of await list()) {
    await page.request.post("/api/channels/close", { data: { ...channel, force: false } });
  }
  await expect
    .poll(
      async (): Promise<number> => {
        await mine(page, 1);
        return (await list()).length;
      },
      { timeout: 90_000 },
    )
    .toBe(0);
}

test("fund, open a channel, pay in both directions, close", async ({ page }) => {
  test.skip(TOKEN === "", "set LN_API_TOKEN to the token given to docker compose");

  await closeLeftoverChannels(page);

  // === Fund the wallet
  await page.goto("/wallet");
  await page.getByRole("button", { name: "New address" }).click();
  const address = (await page.getByTestId("address").textContent()) ?? "";
  expect(address).toMatch(/^bcrt1/);

  await mine(page, 101);
  await rpc(page, "/wallet/e2e", "sendtoaddress", [address, 0.02]);
  const peerAddress = (await peerApi<{ address: string }>(page, "wallet/address", {})).address;
  await rpc(page, "/wallet/e2e", "sendtoaddress", [peerAddress, 0.001]);
  await mine(page, 6);
  await page.goto("/");
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText("Synced")).toBeVisible({ timeout: 60_000 });
  // Balances are not exact on a stack that has run before, so wait for enough spendable funds.
  await expect
    .poll(
      async (): Promise<number> => {
        const response = await page.request.get("/api/wallet/balance");
        const balances = (await response.json()) as { onchain_spendable_sat: string };
        return Number(balances.onchain_spendable_sat);
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThanOrEqual(1_500_000);
  await page.goto("/wallet");
  await expect(page.getByText("On-chain spendable")).toBeVisible();

  // === Open a channel to the peer
  const peer = await peerApi<{ node_id: string }>(page, "node/status");
  await page.goto("/channels");
  await page.getByLabel("Peer node id").fill(peer.node_id);
  await page.getByLabel("Peer address").fill("api-peer:9735");
  await page.getByLabel("Capacity (sat)").fill("1000000");
  await page.getByRole("button", { name: "Open channel" }).click();
  await expect(page.getByTestId("channel")).toBeVisible({ timeout: 60_000 });
  // The funding transaction may reach bitcoind after the first blocks are mined, so keep mining
  // and syncing until the channel is usable.
  await expect
    .poll(
      async (): Promise<boolean> => {
        await mine(page, 2);
        await page.request.post("/api/node/sync");
        const channels = (await (await page.request.get("/api/channels")).json()) as { is_usable: boolean }[];
        return channels.length === 1 && channels[0].is_usable;
      },
      { timeout: 90_000 },
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByTestId("channel")).toContainText("Still open");
  await expect(page.getByTestId("channel-allowance")).toContainText("Capacity");

  // === Send: we pay the peer's invoice through the decoder firewall
  const theirs = await peerApi<{ invoice: string }>(page, "invoices", {
    amount_msat: "60000000",
    description: "e2e tip",
  });
  await page.goto("/send");
  await page.getByLabel("BOLT11 invoice").fill(theirs.invoice);
  await expect(page.getByRole("region", { name: "Verdict" })).toContainText("Payable");
  await page.getByRole("button", { name: "Review payment" }).click();
  await page.getByRole("button", { name: "Yes, pay" }).click();
  await expect(page.getByText("Payment sent")).toBeVisible();

  // === Receive: the peer pays our invoice. It can only do so because we paid it first: a channel
  // reserve (1% of capacity) is held back from the side that starts with nothing.
  await page.goto("/receive");
  await page.getByLabel("Amount (sat)").fill("5000");
  await page.getByLabel("Description").fill("e2e coffee");
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByAltText("QR code of the invoice")).toBeVisible();
  const invoice = (await page.getByTestId("invoice").textContent()) ?? "";
  expect(invoice).toMatch(/^lnbcrt50u1/);
  await peerApi(page, "payments", { invoice });
  await expect(page.getByRole("status").filter({ hasText: "Received 5,000 sat" })).toBeVisible({ timeout: 60_000 });

  // === History and live events
  await page.goto("/payments");
  // Earlier runs leave rows behind (including unpaid invoices as "pending"), so match on status too.
  const succeeded = (amount: string) =>
    page.getByTestId("payment").filter({ hasText: amount }).filter({ hasText: "succeeded" }).first();
  await expect(succeeded("-60,000 sat")).toBeVisible({ timeout: 60_000 });
  await expect(succeeded("+5,000 sat")).toBeVisible();

  // === Close the channel cooperatively
  await page.goto("/channels");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Yes, close" }).click();
  await mine(page, 3);
  await expect(page.getByText("No channels yet")).toBeVisible({ timeout: 90_000 });
});
