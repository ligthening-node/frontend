"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { SwapIcon } from "@/components/ui/swap-icon";
import { MOTION_KEY, isMotionOff } from "@/lib/motion-pref";

/** The pref lives on the html element (`data-motion="off"`), so the background can watch it too. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return (): void => observer.disconnect();
}

function motionIsOff(): boolean {
  return isMotionOff(document.documentElement.dataset.motion);
}

/**
 * Pauses or resumes the animated background. It starts by itself and loops, so people must be able
 * to stop it (WCAG 2.2.2). The choice is remembered when storage is available.
 */
export function MotionToggle(): ReactElement {
  const off = useSyncExternalStore<boolean>(subscribe, motionIsOff, (): boolean => false);

  function toggle(): void {
    const next = !off;
    if (next) {
      document.documentElement.dataset.motion = "off";
    } else {
      delete document.documentElement.dataset.motion;
    }
    try {
      localStorage.setItem(MOTION_KEY, next ? "off" : "on");
    } catch {
      // Private windows can block storage; the choice still holds for this visit.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={off ? "Play background motion" : "Pause background motion"}
      aria-pressed={off}
      title={off ? "Play background motion" : "Pause background motion"}
      onClick={toggle}
      className="size-10 md:size-8"
    >
      <SwapIcon swapped={off} from={<PauseIcon className="size-4" />} to={<PlayIcon className="size-4" />} />
    </Button>
  );
}
