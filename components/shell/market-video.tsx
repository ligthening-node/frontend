"use client";

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import { prefersSavingData, shouldPlayVideo } from "@/lib/market-video";

/**
 * A soft, looping video behind the whole app at 30% opacity (a flowing line chart and payment
 * flows, all made up). It is decoration, so it never takes focus or input, and it
 * stays on its first frame when the user prefers reduced motion, paused the background motion, asked
 * the browser to save data, or switched to another tab.
 */
export function MarketVideo(): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect((): (() => void) | undefined => {
    const video = videoRef.current;
    if (video === null) {
      return undefined;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;

    const sync = (): void => {
      const play = shouldPlayVideo({
        reducedMotion: reduceMotion.matches,
        motionOff: root.dataset.motion === "off",
        saveData: prefersSavingData(navigator),
        hidden: document.hidden,
      });
      if (play) {
        // A blocked autoplay rejects; the poster frame simply stays up.
        video.play().catch((): void => undefined);
      } else {
        video.pause();
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    reduceMotion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return (): void => {
      observer.disconnect();
      reduceMotion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      data-testid="market-video"
      aria-hidden="true"
      tabIndex={-1}
      muted
      loop
      playsInline
      disablePictureInPicture
      preload="none"
      poster="/media/market-flow-poster.jpg"
      // The scene is drawn for the dark theme; the light theme inverts it so it stays a soft wash.
      className="pointer-events-none fixed inset-0 -z-20 h-full w-full object-cover opacity-30 [html:not(.dark)_&]:hue-rotate-180 [html:not(.dark)_&]:invert"
    >
      <source src="/media/market-flow.webm" type="video/webm" />
    </video>
  );
}
