"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { CheckList } from "@/components/decoder/check-list";
import { isValidPubkey } from "@/components/decoder/context-options";
import { DecodeErrorView } from "@/components/decoder/decode-error-view";
import { InvoiceDetails } from "@/components/decoder/invoice-details";
import { VerdictBanner } from "@/components/decoder/verdict-banner";
import { FieldError } from "@/components/node/field-error";
import { ApiErrorNotice } from "@/components/node/unreachable";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getChannels, getNodeStatus, payInvoice } from "@/lib/api";
import { decodeInvoice, unixNow } from "@/lib/decoder";
import { formatMsat, satInputToMsat, shortHex } from "@/lib/format";
import type { ChannelView } from "@/lib/types/ChannelView";
import type { DecodeResult } from "@/lib/types/DecodeResult";
import type { Decoded } from "@/lib/types/Decoded";
import type { Network } from "@/lib/types/Network";
import type { SentPayment } from "@/lib/types/SentPayment";
import { useAction } from "@/lib/use-action";
import { usePoll } from "@/lib/use-poll";
import { satAmountError } from "@/lib/validate";

const STATUS_POLL_MS = 30000;
const CHANNELS_POLL_MS = 10000;
const NETWORKS: ReadonlySet<string> = new Set(["bitcoin", "testnet", "signet", "regtest"]);

/** The most one payment can carry over the usable channels, or null while channels are unknown. */
function largestSendMsat(channels: ChannelView[] | null): string | null {
  if (channels === null) {
    return null;
  }
  return channels
    .filter((c: ChannelView): boolean => c.is_usable)
    .reduce((max: bigint, c: ChannelView): bigint => (BigInt(c.max_send_msat) > max ? BigInt(c.max_send_msat) : max), BigInt(0))
    .toString();
}

function asNetwork(value: string | undefined): Network | null {
  return value !== undefined && NETWORKS.has(value) ? (value as Network) : null;
}

interface Preview {
  result: DecodeResult;
  evaluatedAt: number;
}

export function Send(): ReactElement {
  const status = usePoll(getNodeStatus, STATUS_POLL_MS);
  const network = asNetwork(status.data?.network);
  const channels = usePoll(getChannels, CHANNELS_POLL_MS);
  const maxSendMsat = largestSendMsat(channels.data);

  const [invoice, setInvoice] = useState<string>("");
  const [expectedPayee, setExpectedPayee] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sent, setSent] = useState<SentPayment | null>(null);

  const payeeOk = expectedPayee.trim() === "" || isValidPubkey(expectedPayee);
  // A cleared or half-typed input hides the last preview instead of resetting it in the effect.
  const shown = invoice.trim() !== "" && payeeOk ? preview : null;

  // The browser preview uses the same Rust decoder as the server, so what you see is what the
  // server will enforce; the server still re-checks before paying.
  useEffect((): (() => void) => {
    let cancelled = false;
    if (invoice.trim() === "" || !payeeOk) {
      return (): void => {};
    }
    const now = unixNow();
    decodeInvoice(invoice, {
      now_unix: now,
      expected_network: network,
      expected_payee: expectedPayee.trim() === "" ? null : expectedPayee.trim(),
      description_preimage: null,
      max_amount_msat: null,
    })
      .then((result: DecodeResult): void => {
        if (!cancelled) {
          setPreview({ result, evaluatedAt: now });
        }
      })
      .catch((): void => {
        if (!cancelled) {
          setPreview(null);
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, [invoice, expectedPayee, payeeOk, network]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Send" description="Pay a Lightning invoice. It is decoded and checked before any money moves." />
      <Card>
        <CardHeader>
          <CardTitle>Pay an invoice</CardTitle>
          <CardDescription>
            Every invoice is decoded and checked before anything is paid: signature, network, expiry, amount limit and,
            if you name one, the payee.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="send-invoice">BOLT11 invoice</Label>
            <Textarea
              id="send-invoice"
              value={invoice}
              onChange={(e): void => {
                setInvoice(e.target.value);
                setSent(null);
              }}
              placeholder="lnbcrt..."
              spellCheck={false}
              autoComplete="off"
              className="min-h-24 font-mono text-xs break-all"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="send-payee">Expected payee (optional)</Label>
            <Input
              id="send-payee"
              value={expectedPayee}
              aria-invalid={!payeeOk}
              placeholder="02... or 03..."
              onChange={(e): void => {
                setExpectedPayee(e.target.value);
                setSent(null);
              }}
              className="font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {status.error !== null && <ApiErrorNotice error={status.error} />}

      {shown !== null && shown.result.status === "error" && (
        <DecodeErrorView input={invoice} error={shown.result.error} message={shown.result.message} />
      )}
      {shown !== null && shown.result.status === "ok" && sent === null && (
        <PayReview
          key={invoice}
          decoded={shown.result.decoded}
          evaluatedAt={shown.evaluatedAt}
          invoice={invoice}
          expectedPayee={expectedPayee.trim() === "" ? null : expectedPayee.trim()}
          maxSendMsat={maxSendMsat}
          onSent={setSent}
        />
      )}
      {sent !== null && (
        <div role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
          <p className="font-semibold">Payment sent</p>
          <p>
            Id <span className="font-mono">{shortHex(sent.payment_id)}</span>{" "}
            <CopyButton value={sent.payment_id} label="payment id" />. The result arrives as a live event and
            shows on the Payments page.
          </p>
        </div>
      )}
    </div>
  );
}

/** Why the channels cannot carry `amountMsat` right now, or null when they can (or are not known yet). */
function liquidityProblem(amountMsat: string | null, maxSendMsat: string | null): string | null {
  if (maxSendMsat === null || amountMsat === null) {
    return null;
  }
  if (BigInt(maxSendMsat) === BigInt(0)) {
    return "No usable channel with balance on your side. Open a channel (and mine blocks) before paying.";
  }
  return BigInt(amountMsat) > BigInt(maxSendMsat)
    ? `Too large for your channels. The most one payment can carry is ${formatMsat(maxSendMsat)}.`
    : null;
}

interface PayReviewProps {
  decoded: Decoded;
  evaluatedAt: number;
  invoice: string;
  expectedPayee: string | null;
  /** Largest single payment the usable channels can carry. Null skips the liquidity check. */
  maxSendMsat?: string | null;
  onSent: (sent: SentPayment) => void;
}

export function PayReview({ decoded, evaluatedAt, invoice, expectedPayee, maxSendMsat = null, onSent }: PayReviewProps): ReactElement {
  const [amountSat, setAmountSat] = useState<string>("");
  const [confirming, setConfirming] = useState<boolean>(false);
  const action = useAction();

  const amountless = decoded.invoice.amount_msat === null;
  const chosenMsat = amountless ? satInputToMsat(amountSat) : null;
  const amountMsat = decoded.invoice.amount_msat ?? chosenMsat;
  const amountError = amountless ? satAmountError(amountSat, 1, null) : null;
  const liquidityError = liquidityProblem(amountMsat, maxSendMsat);
  const payable =
    decoded.report.verdict === "payable" &&
    amountMsat !== null &&
    amountMsat !== "0" &&
    amountError === null &&
    liquidityError === null;

  async function pay(): Promise<void> {
    await action.run(async (): Promise<void> => {
      onSent(await payInvoice({ invoice, amountMsat: chosenMsat, expectedPayee }));
    });
    setConfirming(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <VerdictBanner decoded={decoded} evaluatedAt={evaluatedAt} />
      <Card>
        <CardContent className="flex flex-col gap-3">
          {amountless && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="send-amount">Amount to send (sat)</Label>
              <Input
                id="send-amount"
                inputMode="numeric"
                value={amountSat}
                aria-invalid={amountError !== null}
                onChange={(e): void => setAmountSat(e.target.value)}
              />
              <FieldError message={amountError} />
            </div>
          )}
          <FieldError message={liquidityError} />
          {action.error !== null && <ApiErrorNotice error={action.error} />}
          {action.error?.report != null && <CheckList report={action.error.report} />}
          {!confirming && (
            <div>
              <Button disabled={!payable} onClick={(): void => setConfirming(true)}>
                Review payment
              </Button>
            </div>
          )}
          {confirming && amountMsat !== null && (
            <div role="alertdialog" aria-label="Confirm payment" className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
              <p>
                Pay <strong>{formatMsat(amountMsat)}</strong> to{" "}
                <span className="font-mono">{shortHex(decoded.invoice.payee.pubkey)}</span>? Lightning payments cannot be
                reversed.
              </p>
              <div className="flex gap-2">
                <Button size="sm" disabled={action.busy} onClick={(): void => void pay()}>
                  Yes, pay
                </Button>
                <Button size="sm" variant="ghost" onClick={(): void => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <InvoiceDetails invoice={decoded.invoice} />
        <CheckList report={decoded.report} />
      </div>
    </div>
  );
}
