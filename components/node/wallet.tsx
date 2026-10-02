"use client";

import { useState } from "react";
import type { FormEvent, ReactElement } from "react";

import { BalanceCards } from "@/components/node/balance-cards";
import { ApiErrorNotice } from "@/components/node/unreachable";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/node/field-error";
import { createAddress, getBalances, getNodeStatus, sendOnchain } from "@/lib/api";
import { formatLocalTime } from "@/lib/format";
import { addressError, onchainSendError } from "@/lib/validate";
import { useAction } from "@/lib/use-action";
import { usePoll } from "@/lib/use-poll";

const POLL_MS = 5000;
const STATUS_POLL_MS = 30000;

export function Wallet(): ReactElement {
  const balances = usePoll(getBalances, POLL_MS);
  const status = usePoll(getNodeStatus, STATUS_POLL_MS);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Wallet" description="Your on-chain coins: fund the wallet and send a Bitcoin transaction." />
      {balances.error !== null && <ApiErrorNotice error={balances.error} />}
      {balances.data !== null && <BalanceCards balances={balances.data} />}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <FundCard />
        <SendOnchainCard
          onSent={balances.refresh}
          spendableSat={balances.data?.onchain_spendable_sat ?? null}
          network={status.data?.network ?? null}
        />
      </div>
    </div>
  );
}

function FundCard(): ReactElement {
  const [address, setAddress] = useState<string | null>(null);
  const action = useAction();

  async function onNewAddress(): Promise<void> {
    await action.run(async (): Promise<void> => {
      setAddress(await createAddress());
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fund the wallet</CardTitle>
        <CardDescription>
          Generate a fresh address, then send regtest coins to it (Polar, or backend/scripts/regtest.sh fund).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {action.error !== null && <ApiErrorNotice error={action.error} />}
        <div>
          <Button onClick={(): void => void onNewAddress()} disabled={action.busy}>
            New address
          </Button>
        </div>
        {address !== null && (
          <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2">
            <p data-testid="address" className="flex-1 break-all font-mono text-sm">
              {address}
            </p>
            <CopyButton value={address} label="address" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SendOnchainProps {
  onSent: () => void;
  spendableSat: string | null;
  network: string | null;
}

function SendOnchainCard({ onSent, spendableSat, network }: SendOnchainProps): ReactElement {
  const [address, setAddress] = useState<string>("");
  const [amountSat, setAmountSat] = useState<string>("");
  const [txid, setTxid] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const action = useAction();
  const amountError = onchainSendError(amountSat, spendableSat);
  const addrError = addressError(address, network);
  const ready = amountSat.trim() !== "" && amountError === null && address.trim() !== "" && addrError === null;

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const ok = await action.run(async (): Promise<void> => {
      setTxid(await sendOnchain(address.trim(), amountSat.trim()));
      setSentAt(Date.now());
    });
    if (ok) {
      onSent();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send on-chain</CardTitle>
        <CardDescription>A normal Bitcoin transaction from the node&apos;s wallet.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={(e): void => void onSubmit(e)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="send-address">Address</Label>
            <Input
              id="send-address"
              value={address}
              onChange={(e): void => setAddress(e.target.value)}
              placeholder="bcrt1..."
              aria-invalid={addrError !== null}
              className="font-mono"
            />
            <FieldError message={addrError} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="send-onchain-amount">Amount (sat)</Label>
            <Input
              id="send-onchain-amount"
              inputMode="numeric"
              value={amountSat}
              aria-invalid={amountError !== null}
              onChange={(e): void => setAmountSat(e.target.value)}
            />
            <FieldError message={amountError} />
          </div>
          {action.error !== null && <ApiErrorNotice error={action.error} />}
          <div>
            <Button type="submit" disabled={action.busy || !ready}>
              Send
            </Button>
          </div>
          {txid !== null && (
            <p className="break-all text-sm">
              Sent{sentAt === null ? "" : ` at ${formatLocalTime(sentAt)}`}. Transaction{" "}
              <span className="font-mono">{txid}</span> <CopyButton value={txid} label="transaction id" />
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
