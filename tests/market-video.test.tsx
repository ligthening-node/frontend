import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketVideo } from "@/components/shell/market-video";
import { prefersSavingData, shouldPlayVideo } from "@/lib/market-video";

const FREE = { reducedMotion: false, motionOff: false, saveData: false, hidden: false };

describe("shouldPlayVideo", () => {
  it("plays when nothing blocks it", () => {
    expect(shouldPlayVideo(FREE)).toBe(true);
  });

  it("stays on the poster for each blocker", () => {
    expect(shouldPlayVideo({ ...FREE, reducedMotion: true })).toBe(false);
    expect(shouldPlayVideo({ ...FREE, motionOff: true })).toBe(false);
    expect(shouldPlayVideo({ ...FREE, saveData: true })).toBe(false);
    expect(shouldPlayVideo({ ...FREE, hidden: true })).toBe(false);
  });

  it("reads the Data Saver hint", () => {
    expect(prefersSavingData({ connection: { saveData: true } })).toBe(true);
    expect(prefersSavingData({ connection: { saveData: false } })).toBe(false);
    expect(prefersSavingData({})).toBe(false);
  });
});

describe("MarketVideo", () => {
  it("is decorative: hidden from assistive tech, unfocusable, 30% opacity, loops muted", () => {
    // jsdom has no media playback, so stub what the component calls.
    window.HTMLMediaElement.prototype.play = (): Promise<void> => Promise.resolve();
    window.HTMLMediaElement.prototype.pause = (): void => {};
    window.matchMedia = ((): MediaQueryList =>
      ({ matches: false, addEventListener: (): void => {}, removeEventListener: (): void => {} }) as unknown as MediaQueryList) as typeof window.matchMedia;
    render(<MarketVideo />);
    const video = screen.getByTestId("market-video") as HTMLVideoElement;
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video).toHaveAttribute("tabindex", "-1");
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.className).toContain("opacity-30");
    expect(video.className).toContain("pointer-events-none");
    expect(video.querySelector("source")).toHaveAttribute("src", "/media/market-flow.webm");
  });
});
