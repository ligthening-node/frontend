"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { FormEvent, ReactElement } from "react";

import { ChannelRequiredNotice } from "@/components/node/channel-required-notice";
import { ApiErrorNotice } from "@/components/node/unreachable";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvoice, getChannels } from "@/lib/api";
import { FieldError } from "@/components/node/field-error";
import { satInputToMsat } from "@/lib/format";
import { descriptionError, expiryError, invoiceAmountError } from "@/lib/validate";
import type { ChannelView } from "@/lib/types/ChannelView";
import type { CreatedInvoice } from "@/lib/types/CreatedInvoice";
import { useAction } from "@/lib/use-action";
import { usePoll } from "@/lib/use-poll";

const DEFAULT_EXPIRY_SECS = 3600;
const CHANNELS_POLL_MS = 10000;

/**
 * Why no invoice can be created yet, or null when at least one channel is usable (or the channels
 * are not known yet). Without a usable channel nobody can pay the invoice.
 */
export function receiveChannelProblem(channels: ChannelView[] | null): string | null {
  if (channels === null) {
    return null;
  }
  if (channels.length === 0) {
    return "You have no channel yet. Create a channel first, then come back to create an invoice.";
  }
  if (!channels.some((c: ChannelView): boolean => c.is_usable)) {
    return "None of your channels is usable yet: it is still confirming or the peer is offline. Wait for it, or create a new channel.";
  }
  return null;
}

export function Receive(): ReactElement {
  const [amountSat, setAmountSat] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [expiry, setExpiry] = useState<string>(String(DEFAULT_EXPIRY_SECS));
  const [created, setCreated] = useState<CreatedInvoice | null>(null);
  const action = useAction();
  const channels = usePoll(getChannels, CHANNELS_POLL_MS);
  const channelProblem = receiveChannelProblem(channels.data);

  const amountMsat = amountSat.trim() === "" ? null : satInputToMsat(amountSat);
  const amountError = invoiceAmountError(amountSat);
  const expiryErr = expiryError(expiry);
  const descriptionErr = descriptionError(description);
  const formOk =
    channelProblem === null && amountError === null && expiryErr === null && descriptionErr === null;

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await action.run(async (): Promise<void> => {
      setCreated(await createInvoice({ amountMsat, description, expirySecs: Number(expiry) }));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Receive" description="Create an invoice for someone to pay over Lightning." />
      {channelProblem !== null && <ChannelRequiredNotice message={channelProblem} />}
      <Card>
        <CardHeader>
          <CardTitle>Create an invoice</CardTitle>
          <CardDescription>
            Leave the amount empty for an any-amount invoice: the payer chooses how much to send.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={(e): void => void onSubmit(e)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="receive-amount">Amount (sat)</Label>
                <Input
                  id="receive-amount"
                  inputMode="numeric"
                  value={amountSat}
                  placeholder="any amount"
                  aria-invalid={amountError !== null}
                  onChange={(e): void => setAmountSat(e.target.value)}
                />
                <FieldError message={amountError} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="receive-expiry">Expires after (seconds)</Label>
                <Input
                  id="receive-expiry"
                  inputMode="numeric"
                  value={expiry}
                  aria-invalid={expiryErr !== null}
                  onChange={(e): void => setExpiry(e.target.value)}
                />
                <FieldError message={expiryErr} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="receive-description">Description</Label>
              <Input
                id="receive-description"
                value={description}
                placeholder="What is this payment for?"
                aria-invalid={descriptionErr !== null}
                onChange={(e): void => setDescription(e.target.value)}
              />
              <FieldError message={descriptionErr} />
            </div>
            {action.error !== null && <ApiErrorNotice error={action.error} />}
            <div>
              <Button type="submit" disabled={action.busy || !formOk}>
                Create invoice
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {created !== null && <InvoiceQr key={created.invoice} invoice={created.invoice} />}
    </div>
  );
}

export function InvoiceQr({ invoice }: { invoice: string }): ReactElement {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect((): (() => void) => {
    let cancelled = false;
    // Upper case fits QR alphanumeric mode, so the code is smaller; BOLT11 allows either case.
    QRCode.toDataURL(`lightning:${invoice}`.toUpperCase(), { margin: 1, width: 320 })
      .then((url: string): void => {
        if (!cancelled) {
          setDataUrl(url);
        }
      })
      .catch((): void => {
        if (!cancelled) {
          setDataUrl(null);
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, [invoice]);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(invoice);
    setCopied(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice</CardTitle>
        <CardDescription>Pay it from the peer node, or open it in the Decoder to see what is inside.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {dataUrl !== null && (
          // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing to optimize
          <img src={dataUrl} alt="QR code of the invoice" width={320} height={320} className="rounded-md bg-white" />
        )}
        <p data-testid="invoice" className="w-full break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
          {invoice}
        </p>
        <Button variant="outline" onClick={(): void => void copy()}>
          {copied ? "Copied" : "Copy invoice"}
        </Button>
      </CardContent>
    </Card>
  );
}
