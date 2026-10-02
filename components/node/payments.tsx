"use client";

import { ArrowDownLeftIcon, ArrowUpRightIcon, CircleCheckIcon, CircleXIcon, ClockIcon, ReceiptIcon } from "lucide-react";
import type { ReactElement } from "react";

import { ApiErrorNotice } from "@/components/node/unreachable";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPayments } from "@/lib/api";
import { formatLocalTime, formatMsat, formatUnixUtc, shortHex } from "@/lib/format";
import type { PaymentKindView } from "@/lib/types/PaymentKindView";
import type { PaymentState } from "@/lib/types/PaymentState";
import type { PaymentView } from "@/lib/types/PaymentView";
import { usePoll } from "@/lib/use-poll";

const POLL_MS = 3000;

const KIND_LABELS: Record<PaymentKindView, string> = {
  onchain: "On-chain",
  bolt11: "Lightning",
  bolt11_jit: "Lightning (JIT)",
  bolt12_offer: "BOLT12 offer",
  bolt12_refund: "BOLT12 refund",
  spontaneous: "Keysend",
};

/** Status is an icon and a word, never colour alone. */
const STATUS_STYLE: Record<PaymentState, { className: string; icon: ReactElement }> = {
  succeeded: { className: "bg-success/15 text-success", icon: <CircleCheckIcon className="size-3.5" /> },
  pending: { className: "bg-warning/15 text-warning", icon: <ClockIcon className="size-3.5" /> },
  failed: { className: "bg-destructive/15 text-destructive", icon: <CircleXIcon className="size-3.5" /> },
};

function StatusPill({ status }: { status: PaymentState }): ReactElement {
  const style = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style.className}`}>
      {style.icon}
      {status}
    </span>
  );
}

function amountText(payment: PaymentView): string {
  const sign = payment.direction === "inbound" ? "+" : "-";
  return payment.amount_msat === null ? "?" : `${sign}${formatMsat(payment.amount_msat)}`;
}

function amountClass(payment: PaymentView): string {
  return payment.direction === "inbound" ? "text-success" : "text-foreground";
}

function DirectionIcon({ payment }: { payment: PaymentView }): ReactElement {
  const inbound = payment.direction === "inbound";
  return (
    <span
      className={`flex size-8 shrink-0 items-center justify-center rounded-full ${inbound ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
    >
      {inbound ? <ArrowDownLeftIcon className="size-4" aria-hidden /> : <ArrowUpRightIcon className="size-4" aria-hidden />}
      <span className="sr-only">{inbound ? "Received" : "Sent"}</span>
    </span>
  );
}

function Reference({ payment }: { payment: PaymentView }): ReactElement | null {
  const reference = payment.payment_hash ?? payment.txid;
  if (reference === null) {
    return null;
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs" title={reference}>
      {shortHex(reference, 8)}
      <CopyButton value={reference} label={payment.payment_hash !== null ? "payment hash" : "transaction id"} />
    </span>
  );
}

export function Payments(): ReactElement {
  const payments = usePoll(getPayments, POLL_MS);
  const list = payments.data ?? [];
  const pending = list.filter((p: PaymentView): boolean => p.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payments</h1>
          <p className="text-sm text-muted-foreground">Everything this node has sent or received, newest first.</p>
        </div>
        {payments.data !== null && list.length > 0 && (
          <p className="text-sm text-muted-foreground" data-testid="payment-summary">
            {list.length} {list.length === 1 ? "payment" : "payments"}
            {pending > 0 && <span className="text-warning"> · {pending} pending</span>}
          </p>
        )}
      </div>
      {payments.error !== null && <ApiErrorNotice error={payments.error} />}
      <Card>
        <CardContent className="px-0">
          {payments.data !== null && list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <ReceiptIcon className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">No payments yet.</p>
              <p className="text-sm text-muted-foreground">Receive or send something and it will show up here.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>When</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hash or txid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((payment: PaymentView) => (
                      <TableRow key={payment.id} data-testid="payment">
                        <TableCell className="whitespace-nowrap text-muted-foreground" title={formatUnixUtc(payment.updated_at)}>
                          {formatLocalTime(payment.updated_at * 1000)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <DirectionIcon payment={payment} />
                            {KIND_LABELS[payment.kind]}
                          </span>
                        </TableCell>
                        <TableCell className={`text-right font-mono font-medium whitespace-nowrap ${amountClass(payment)}`}>
                          {amountText(payment)}
                        </TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap text-muted-foreground">
                          {payment.fee_paid_msat === null ? "" : formatMsat(payment.fee_paid_msat)}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={payment.status} />
                        </TableCell>
                        <TableCell>
                          <Reference payment={payment} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="flex flex-col divide-y md:hidden">
                {list.map((payment: PaymentView) => (
                  <li key={payment.id} data-testid="payment-card" className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <DirectionIcon payment={payment} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{KIND_LABELS[payment.kind]}</p>
                        <p className="text-xs text-muted-foreground" title={formatUnixUtc(payment.updated_at)}>
                          {formatLocalTime(payment.updated_at * 1000)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono font-medium ${amountClass(payment)}`}>{amountText(payment)}</p>
                        {payment.fee_paid_msat !== null && (
                          <p className="font-mono text-xs text-muted-foreground">fee {formatMsat(payment.fee_paid_msat)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={payment.status} />
                      <Reference payment={payment} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
