"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { SwapIcon } from "@/components/ui/swap-icon";

const CONFIRM_MS = 1500;

/** `navigator.clipboard` only exists on https and localhost, so fall back to a hidden textarea. */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

interface CopyButtonProps {
  /** The full value to copy, never a shortened display form. */
  value: string;
  /** What is being copied, for the accessible label, for example "node id". */
  label: string;
}

/** A small icon button that copies `value` and shows a check mark for a moment. */
export function CopyButton({ value, label }: CopyButtonProps): ReactElement {
  const [copied, setCopied] = useState<boolean>(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect((): (() => void) => {
    return (): void => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  async function copy(): Promise<void> {
    if (!(await writeToClipboard(value))) {
      return;
    }
    setCopied(true);
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout((): void => setCopied(false), CONFIRM_MS);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      onClick={(): void => void copy()}
    >
      <SwapIcon swapped={copied} from={<CopyIcon className="size-3" />} to={<CheckIcon className="size-3" />} />
    </Button>
  );
}
