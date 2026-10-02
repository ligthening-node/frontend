import { expect, test } from "@playwright/test";

// The decoder runs entirely in the browser (Rust compiled to WebAssembly), so no node is needed.

test("decodes a spec invoice and explains it", async ({ page }) => {
  await page.goto("/decode");
  await page.getByRole("button", { name: "Coffee, 1 minute expiry" }).click();

  const verdict = page.getByRole("region", { name: "Verdict" });
  await expect(verdict).toContainText("Payable");
  await expect(verdict).toContainText("250000 sat");
  await expect(page.getByText("payee key recovered from the signature")).toBeVisible();
});

test("points at the broken character of an unreadable invoice", async ({ page }) => {
  await page.goto("/decode");
  await page.getByRole("button", { name: "Bad checksum (unreadable)" }).click();
  await expect(page.getByText("Cannot read this invoice")).toBeVisible();
});

test("the Send page refuses an invoice for another network before calling the node", async ({ page }) => {
  let paid = false;
  await page.route("**/api/node/status", (route) =>
    route.fulfill({
      json: {
        node_id: "02" + "11".repeat(32),
        network: "regtest",
        is_running: true,
        block_height: 101,
        best_block_hash: "00",
        is_synced: true,
        last_onchain_sync: null,
        last_lightning_sync: null,
        listening_addresses: [],
      },
    }),
  );
  await page.route("**/api/payments", (route) => {
    paid = true;
    return route.fulfill({ json: { payment_id: "00" } });
  });
  await page.route("**/api/events", (route) => route.abort());

  await page.goto("/decode");
  await page.getByRole("button", { name: "Coffee, 1 minute expiry" }).click();
  const invoice = await page.getByLabel("BOLT11 invoice").inputValue();

  await page.goto("/send");
  await page.getByLabel("BOLT11 invoice").fill(invoice);
  await expect(page.getByRole("region", { name: "Verdict" })).toContainText("Not payable");
  await expect(page.getByRole("button", { name: "Review payment" })).toBeDisabled();
  expect(paid).toBe(false);
});
