import type { ReactElement, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/decoder/info-tip";
import { TAG_INFO } from "@/lib/field-info";
import { amountParts, formatUnixUtc, networkName, shortHex } from "@/lib/format";
import type { DecodedInvoice } from "@/lib/types/DecodedInvoice";

const FALLBACK_KIND: Record<number, string> = { 17: "P2PKH", 18: "P2SH" };

function Row({ label, explanation, children }: { label: string; explanation?: string; children: ReactNode }): ReactElement {
  return (
    <div className="grid gap-1 border-b py-2 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">
        {explanation === undefined ? label : <InfoTip label={label} explanation={explanation} />}
      </dt>
      <dd className="text-sm break-all">{children}</dd>
    </div>
  );
}

function Hex({ value }: { value: string | null }): ReactElement {
  if (value === null) {
    return <span className="text-destructive">missing</span>;
  }
  return (
    <span className="font-mono text-xs" title={value}>
      {value}
    </span>
  );
}

export function InvoiceDetails({ invoice }: { invoice: DecodedInvoice }): ReactElement {
  const amount = invoice.amount_msat === null ? null : amountParts(invoice.amount_msat);
  const explicitPayee = invoice.payee.source === "explicit";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fields</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl>
          <Row label="Network">{networkName(invoice.network)}</Row>
          <Row label="Amount" explanation="Set in the readable part. 1 BTC = 100,000,000 sat = 100,000,000,000 msat.">
            {amount === null ? (
              "Any amount (the payer decides)"
            ) : (
              <span className="flex flex-col">
                <span>{amount.sat} sat</span>
                <span className="text-xs text-muted-foreground">
                  {amount.msat} msat = {amount.btc} BTC
                </span>
              </span>
            )}
          </Row>
          <Row label="Created">{formatUnixUtc(invoice.timestamp)}</Row>
          <Row label="Expiry" explanation={TAG_INFO.x.explanation}>
            {invoice.expiry_secs} s{invoice.expiry_is_default ? " (default)" : ""}, until{" "}
            {formatUnixUtc(invoice.expires_at)}
          </Row>
          <Row label="Description" explanation={TAG_INFO.d.explanation}>
            {invoice.description === null && <span className="text-destructive">missing</span>}
            {invoice.description?.kind === "direct" && <span>{invoice.description.value}</span>}
            {invoice.description?.kind === "hash" && (
              <span className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Only a hash of the description:</span>
                <Hex value={invoice.description.value} />
              </span>
            )}
          </Row>
          <Row label="Payment hash" explanation={TAG_INFO.p.explanation}>
            <Hex value={invoice.payment_hash} />
          </Row>
          <Row label="Payment secret" explanation={TAG_INFO.s.explanation}>
            <Hex value={invoice.payment_secret} />
          </Row>
          <Row label="Payee" explanation={TAG_INFO.n.explanation}>
            <span className="flex flex-col gap-1">
              <Hex value={invoice.payee.pubkey} />
              <Badge variant={explicitPayee ? "default" : "secondary"}>
                {explicitPayee ? "from the n field" : "recovered from the signature"}
              </Badge>
            </span>
          </Row>
          <Row label="Min final CLTV" explanation={TAG_INFO.c.explanation}>
            {invoice.min_final_cltv_expiry} blocks
          </Row>
          {invoice.metadata !== null && (
            <Row label="Metadata" explanation={TAG_INFO.m.explanation}>
              <Hex value={invoice.metadata} />
            </Row>
          )}
        </dl>

        {invoice.route_hints.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">
              <InfoTip label="Route hints" explanation={TAG_INFO.r.explanation} />
            </h3>
            {invoice.route_hints.map((hint, hintIndex) => (
              <ol key={hintIndex} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <li className="text-xs text-muted-foreground">Route {hintIndex + 1}</li>
                {hint.map((hop, hopIndex) => (
                  <li key={hopIndex} className="grid gap-1 sm:grid-cols-2">
                    <span className="font-mono text-xs" title={hop.pubkey}>
                      {shortHex(hop.pubkey)}
                    </span>
                    <span>channel {hop.short_channel_id}</span>
                    <span>
                      fee {hop.fee_base_msat} msat + {hop.fee_proportional_millionths} ppm
                    </span>
                    <span>CLTV delta {hop.cltv_expiry_delta}</span>
                  </li>
                ))}
              </ol>
            ))}
          </section>
        )}

        {invoice.fallbacks.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">
              <InfoTip label="On-chain fallbacks" explanation={TAG_INFO.f.explanation} />
            </h3>
            <ul className="flex flex-col gap-1 text-sm">
              {invoice.fallbacks.map((fallback) => (
                <li key={fallback.address} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs break-all">{fallback.address}</span>
                  <Badge variant="outline">{FALLBACK_KIND[fallback.version] ?? `segwit v${fallback.version}`}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {invoice.features.bits.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">
              <InfoTip label="Features" explanation={TAG_INFO["9"].explanation} />
            </h3>
            <ul className="flex flex-wrap gap-2">
              {invoice.features.known.map((feature) => (
                <li key={feature.bit}>
                  <Badge variant="secondary">
                    {feature.bit} {feature.name} ({feature.required ? "required" : "optional"})
                  </Badge>
                </li>
              ))}
              {invoice.features.unknown_required.map((bit) => (
                <li key={bit}>
                  <Badge variant="destructive">{bit} unknown, required</Badge>
                </li>
              ))}
              {invoice.features.unknown_optional.map((bit) => (
                <li key={bit}>
                  <Badge variant="outline">{bit} unknown, optional</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
