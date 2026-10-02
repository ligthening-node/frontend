"use client";

import type { ReactElement } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DecodeContext } from "@/lib/types/DecodeContext";
import type { Network } from "@/lib/types/Network";

export type EvaluateAt = "now" | "created";

export interface DecoderSettings {
  network: Network | "any";
  expectedPayee: string;
  descriptionPreimage: string;
  maxMsat: string;
  evaluateAt: EvaluateAt;
}

export const DEFAULT_SETTINGS: DecoderSettings = {
  network: "any",
  expectedPayee: "",
  descriptionPreimage: "",
  maxMsat: "",
  evaluateAt: "now",
};

const NETWORK_LABELS: Record<DecoderSettings["network"], string> = {
  any: "Any network",
  bitcoin: "Mainnet",
  testnet: "Testnet",
  signet: "Signet",
  regtest: "Regtest",
};

const EVALUATE_LABELS: Record<EvaluateAt, string> = {
  now: "Now",
  created: "When the invoice was created",
};

const PUBKEY_PATTERN = /^0[23][0-9a-f]{64}$/i;
const MSAT_PATTERN = /^\d+$/;

export function isValidPubkey(value: string): boolean {
  return PUBKEY_PATTERN.test(value.trim());
}

export function isValidMsat(value: string): boolean {
  return MSAT_PATTERN.test(value.trim());
}

/** Builds the decoder's context. Invalid optional fields are left out and flagged in the form instead. */
export function toDecodeContext(settings: DecoderSettings, nowUnix: number): DecodeContext {
  const payee = settings.expectedPayee.trim();
  const maxMsat = settings.maxMsat.trim();
  return {
    now_unix: nowUnix,
    expected_network: settings.network === "any" ? null : settings.network,
    expected_payee: isValidPubkey(payee) ? payee.toLowerCase() : null,
    description_preimage: settings.descriptionPreimage === "" ? null : settings.descriptionPreimage,
    max_amount_msat: isValidMsat(maxMsat) ? maxMsat : null,
  };
}

interface ContextOptionsProps {
  settings: DecoderSettings;
  onChange: (next: DecoderSettings) => void;
}

export function ContextOptions({ settings, onChange }: ContextOptionsProps): ReactElement {
  const update = <K extends keyof DecoderSettings>(key: K, value: DecoderSettings[K]): void => {
    onChange({ ...settings, [key]: value });
  };
  const payeeInvalid = settings.expectedPayee.trim() !== "" && !isValidPubkey(settings.expectedPayee);
  const msatInvalid = settings.maxMsat.trim() !== "" && !isValidMsat(settings.maxMsat);

  return (
    <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-medium">Checks against your expectations (optional)</legend>

      <div className="flex flex-col gap-2">
        <Label>Expected network</Label>
        <Select
          value={settings.network}
          onValueChange={(value: DecoderSettings["network"] | null): void => {
            if (value !== null) {
              update("network", value);
            }
          }}
        >
          <SelectTrigger className="w-full" aria-label="Expected network">
            <SelectValue>{(value: DecoderSettings["network"]): string => NETWORK_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(NETWORK_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Evaluate expiry</Label>
        <Select
          value={settings.evaluateAt}
          onValueChange={(value: EvaluateAt | null): void => {
            if (value !== null) {
              update("evaluateAt", value);
            }
          }}
        >
          <SelectTrigger className="w-full" aria-label="Evaluate expiry">
            <SelectValue>{(value: EvaluateAt): string => EVALUATE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(EVALUATE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="expected-payee">Expected payee public key</Label>
        <Input
          id="expected-payee"
          value={settings.expectedPayee}
          onChange={(event): void => update("expectedPayee", event.target.value)}
          placeholder="03e7156ae33b..."
          spellCheck={false}
          aria-invalid={payeeInvalid}
          className="font-mono text-xs"
        />
        {payeeInvalid && (
          <span className="text-xs text-destructive">Expected 66 hex characters starting with 02 or 03.</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="max-msat">Maximum amount (msat)</Label>
        <Input
          id="max-msat"
          value={settings.maxMsat}
          onChange={(event): void => update("maxMsat", event.target.value)}
          placeholder="e.g. 1000000"
          inputMode="numeric"
          aria-invalid={msatInvalid}
        />
        {msatInvalid && <span className="text-xs text-destructive">Whole millisatoshis only.</span>}
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="description-preimage">Description text to check against a description hash</Label>
        <Input
          id="description-preimage"
          value={settings.descriptionPreimage}
          onChange={(event): void => update("descriptionPreimage", event.target.value)}
          placeholder="Only used when the invoice has an h field"
        />
      </div>
    </fieldset>
  );
}
