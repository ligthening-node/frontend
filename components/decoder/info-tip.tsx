"use client";

import { InfoIcon } from "lucide-react";
import type { ReactElement } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** A label with a learning tooltip that explains what the field means. */
export function InfoTip({ label, explanation }: { label: string; explanation: string }): ReactElement {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger
          aria-label={`What is ${label}?`}
          className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2"
        >
          <InfoIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">{explanation}</TooltipContent>
      </Tooltip>
    </span>
  );
}
