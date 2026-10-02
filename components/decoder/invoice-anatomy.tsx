"use client";

import { useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEGMENT_INFO, tagInfo } from "@/lib/field-info";
import type { FieldInfo } from "@/lib/field-info";
import { amountParts, formatUnixUtc, networkName } from "@/lib/format";
import type { Decoded } from "@/lib/types/Decoded";
import type { FieldStatus } from "@/lib/types/FieldStatus";
import type { RawField } from "@/lib/types/RawField";

const KIND_COLORS: Record<string, string> = {
  hrp: "bg-sky-500/20 text-sky-950 dark:text-sky-100",
  separator: "bg-zinc-500/20",
  timestamp: "bg-violet-500/20 text-violet-950 dark:text-violet-100",
  signature: "bg-rose-500/20 text-rose-950 dark:text-rose-100",
  checksum: "bg-zinc-500/30",
};

// Tagged fields alternate colors so neighbours are easy to tell apart.
const FIELD_COLORS: ReadonlyArray<string> = [
  "bg-emerald-500/20 text-emerald-950 dark:text-emerald-100",
  "bg-amber-500/25 text-amber-950 dark:text-amber-100",
  "bg-teal-500/20 text-teal-950 dark:text-teal-100",
  "bg-orange-500/20 text-orange-950 dark:text-orange-100",
];

const STATUS_NOTES: Record<FieldStatus, string | null> = {
  parsed: null,
  duplicate: "Duplicate: an earlier copy of this field is used.",
  skipped_bad_length: "Wrong length for this field type, so it is ignored.",
  invalid: "Could not be read, so it is ignored.",
  unknown: "Unknown field type, skipped as the spec requires.",
};

function segmentInfo(segment: RawField): FieldInfo {
  if (segment.kind === "tagged_field") {
    return tagInfo(segment.tag ?? "?");
  }
  return SEGMENT_INFO[segment.kind];
}

/** The decoded value behind a segment, where one exists. */
function segmentValue(segment: RawField, decoded: Decoded, index: number): string | null {
  const inv = decoded.invoice;
  if (segment.kind === "hrp") {
    const amount = inv.amount_msat === null ? "any amount" : `${amountParts(inv.amount_msat).btc} BTC`;
    return `${networkName(inv.network)}, ${amount}`;
  }
  if (segment.kind === "timestamp") {
    return formatUnixUtc(inv.timestamp);
  }
  if (segment.kind === "signature") {
    return `payee ${inv.payee.pubkey} (${inv.payee.source === "explicit" ? "from the n field" : "recovered"})`;
  }
  if (segment.kind !== "tagged_field" || segment.status !== "parsed") {
    return null;
  }

  // r and f may repeat; count earlier parsed copies to find the matching entry.
  const nth = decoded.anatomy
    .slice(0, index)
    .filter((other) => other.tag === segment.tag && other.status === "parsed").length;

  switch (segment.tag) {
    case "p":
      return inv.payment_hash;
    case "s":
      return inv.payment_secret;
    case "d":
      return inv.description?.kind === "direct" ? inv.description.value : null;
    case "h":
      return inv.description?.kind === "hash" ? inv.description.value : null;
    case "n":
      return inv.payee.pubkey;
    case "x":
      return `${inv.expiry_secs} seconds`;
    case "c":
      return `${inv.min_final_cltv_expiry} blocks`;
    case "9":
      return `bits ${inv.features.bits.join(", ")}`;
    case "m":
      return inv.metadata;
    case "f":
      return inv.fallbacks[nth]?.address ?? null;
    case "r": {
      const hops = inv.route_hints[nth] ?? [];
      return hops.map((hop) => `${hop.pubkey} via ${hop.short_channel_id}`).join("  ->  ");
    }
    default:
      return null;
  }
}

function segmentColor(segment: RawField, fieldIndex: number): string {
  if (segment.kind !== "tagged_field") {
    return KIND_COLORS[segment.kind];
  }
  const base = FIELD_COLORS[fieldIndex % FIELD_COLORS.length];
  return segment.status === "parsed" ? base : `${base} line-through decoration-2 opacity-60`;
}

export function InvoiceAnatomy({ decoded }: { decoded: Decoded }): ReactElement {
  const [selected, setSelected] = useState<number>(0);
  const segments = decoded.anatomy;
  const current = segments[Math.min(selected, segments.length - 1)];
  const info = segmentInfo(current);
  const value = segmentValue(current, decoded, selected);
  const note = current.note ?? STATUS_NOTES[current.status];

  const fieldIndexes: number[] = [];
  let fieldCount = 0;
  for (const segment of segments) {
    fieldIndexes.push(fieldCount);
    if (segment.kind === "tagged_field") {
      fieldCount += 1;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anatomy</CardTitle>
        <CardDescription>
          Every character of the invoice belongs to one part. Hover, click or tab through the parts to see what each
          one means.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="font-mono text-sm leading-7 break-all">
          {segments.map((segment, index) => {
            const isSelected = index === selected;
            const label = segment.kind === "tagged_field" ? tagInfo(segment.tag ?? "?").name : segmentInfo(segment).name;
            return (
              <span
                key={`${segment.start}-${segment.kind}`}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${label}, characters ${segment.start} to ${segment.start + segment.raw.length}`}
                onMouseEnter={(): void => setSelected(index)}
                onFocus={(): void => setSelected(index)}
                onClick={(): void => setSelected(index)}
                onKeyDown={(event: KeyboardEvent<HTMLSpanElement>): void => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(index);
                  }
                }}
                className={`cursor-pointer rounded-sm px-px outline-none ${segmentColor(segment, fieldIndexes[index])} ${
                  isSelected ? "ring-2 ring-foreground" : ""
                } focus-visible:ring-2 focus-visible:ring-ring`}
              >
                {segment.raw}
              </span>
            );
          })}
        </p>

        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{info.name}</span>
            {current.tag !== null && <Badge variant="outline">tag {current.tag}</Badge>}
            {current.len_words !== null && (
              <Badge variant="secondary">
                {current.len_words} words = {current.len_words * 5} bits
              </Badge>
            )}
            <Badge variant="secondary">
              chars {current.start} to {current.start + current.raw.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{info.explanation}</p>
          {value !== null && (
            <p className="text-sm break-all">
              <span className="font-medium">Decoded: </span>
              <span className="font-mono">{value}</span>
            </p>
          )}
          {note !== null && <p className="text-sm text-amber-700 dark:text-amber-300">{note}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
