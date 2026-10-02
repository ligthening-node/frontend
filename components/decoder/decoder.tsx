"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckList } from "@/components/decoder/check-list";
import { ContextOptions, DEFAULT_SETTINGS, toDecodeContext } from "@/components/decoder/context-options";
import type { DecoderSettings } from "@/components/decoder/context-options";
import { DecodeErrorView } from "@/components/decoder/decode-error-view";
import { InvoiceAnatomy } from "@/components/decoder/invoice-anatomy";
import { InvoiceDetails } from "@/components/decoder/invoice-details";
import { VerdictBanner } from "@/components/decoder/verdict-banner";
import { decodeInvoice, unixNow } from "@/lib/decoder";
import { SAMPLE_INVOICES } from "@/lib/samples";
import type { DecodeResult } from "@/lib/types/DecodeResult";

interface Outcome {
  result: DecodeResult;
  evaluatedAt: number;
}

export function Decoder(): ReactElement {
  const [input, setInput] = useState<string>("");
  const [settings, setSettings] = useState<DecoderSettings>(DEFAULT_SETTINGS);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect((): (() => void) => {
    let cancelled = false;

    async function run(): Promise<void> {
      if (input.trim() === "") {
        setOutcome(null);
        return;
      }
      try {
        const now = unixNow();
        let evaluatedAt = now;
        let result = await decodeInvoice(input, toDecodeContext(settings, now));
        // "As created" re-runs the checks at the invoice's own timestamp, so old examples are not just "expired".
        if (settings.evaluateAt === "created" && result.status === "ok") {
          evaluatedAt = result.decoded.invoice.timestamp;
          result = await decodeInvoice(input, toDecodeContext(settings, evaluatedAt));
        }
        if (!cancelled) {
          setOutcome({ result, evaluatedAt });
          setLoadError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void run();
    return (): void => {
      cancelled = true;
    };
  }, [input, settings]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Invoice</CardTitle>
          <CardDescription>
            Paste a BOLT11 invoice. A <code>lightning:</code> prefix and upper case (from QR codes) are fine.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invoice-input">BOLT11 invoice</Label>
            <Textarea
              id="invoice-input"
              value={input}
              onChange={(event): void => setInput(event.target.value)}
              placeholder="lnbc..."
              spellCheck={false}
              autoComplete="off"
              className="min-h-28 font-mono text-xs break-all"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">Or try an example from the BOLT11 spec:</span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_INVOICES.map((sample) => (
                <Button
                  key={sample.label}
                  variant="outline"
                  size="sm"
                  onClick={(): void => {
                    setInput(sample.invoice);
                    setSettings((prev: DecoderSettings): DecoderSettings => ({ ...prev, evaluateAt: "created" }));
                  }}
                >
                  {sample.label}
                </Button>
              ))}
            </div>
          </div>
          <ContextOptions settings={settings} onChange={setSettings} />
        </CardContent>
      </Card>

      {loadError !== null && (
        <Card className="border-destructive">
          <CardContent className="text-sm text-destructive">
            Could not load the WebAssembly decoder: {loadError}
          </CardContent>
        </Card>
      )}

      {outcome !== null && <Result input={input} outcome={outcome} />}
    </div>
  );
}

function Result({ input, outcome }: { input: string; outcome: Outcome }): ReactElement {
  const { result, evaluatedAt } = outcome;

  if (result.status === "invalid_context") {
    return (
      <Card className="border-destructive">
        <CardContent className="text-sm text-destructive">Invalid options: {result.message}</CardContent>
      </Card>
    );
  }
  if (result.status === "error") {
    return <DecodeErrorView input={input} error={result.error} message={result.message} />;
  }

  const { decoded } = result;
  return (
    <div className="flex flex-col gap-6">
      <VerdictBanner decoded={decoded} evaluatedAt={evaluatedAt} />
      <InvoiceAnatomy decoded={decoded} />
      <div className="grid gap-6 lg:grid-cols-2">
        <InvoiceDetails invoice={decoded.invoice} />
        <CheckList report={decoded.report} />
      </div>
    </div>
  );
}
