import { CircleXIcon } from "lucide-react";
import type { ReactElement } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DecodeError } from "@/lib/types/DecodeError";

const CONTEXT_CHARS = 24;

const HINTS: Partial<Record<DecodeError["code"], string>> = {
  bad_checksum: "A character was changed, added or removed. Copy the whole invoice again.",
  mixed_case: "Invoices must be all lower case or all upper case.",
  missing_separator: "Every invoice has a \"1\" between the readable part and the data.",
  unknown_currency: "It should start with lnbc, lntb, lntbs or lnbcrt.",
  too_short: "The invoice looks truncated.",
};

/** Mirrors the decoder's input cleaning so error positions line up with what we display. */
function cleanInput(input: string): string {
  const trimmed = input.trim();
  return trimmed.toLowerCase().startsWith("lightning:") ? trimmed.slice("lightning:".length) : trimmed;
}

function errorPosition(error: DecodeError): number | null {
  return error.code === "invalid_char" || error.code === "field_overrun" ? error.pos : null;
}

interface DecodeErrorViewProps {
  input: string;
  error: DecodeError;
  message: string;
}

export function DecodeErrorView({ input, error, message }: DecodeErrorViewProps): ReactElement {
  const pos = errorPosition(error);
  const cleaned = cleanInput(input);
  const start = pos === null ? 0 : Math.max(0, pos - CONTEXT_CHARS);
  const hint = HINTS[error.code];

  return (
    <Card className="border-destructive" role="alert">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <CircleXIcon className="size-5" />
          Cannot read this invoice
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>{message}</p>
        {hint !== undefined && <p className="text-muted-foreground">{hint}</p>}
        {pos !== null && pos < cleaned.length && (
          <p className="font-mono text-xs break-all">
            {start > 0 && "..."}
            {cleaned.slice(start, pos)}
            <mark className="rounded-sm bg-red-500 px-0.5 text-white">{cleaned[pos]}</mark>
            {cleaned.slice(pos + 1, pos + 1 + CONTEXT_CHARS)}
            {pos + 1 + CONTEXT_CHARS < cleaned.length && "..."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
