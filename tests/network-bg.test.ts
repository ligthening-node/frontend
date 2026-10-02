import { describe, expect, it } from "vitest";

import { LINK_DISTANCE, MAX_DOTS, dotCount, hexToRgb, linkAlpha, stepDot } from "@/lib/network-bg";

describe("network background helpers", () => {
  it("scales the dot count with the screen and caps it", () => {
    expect(dotCount(390, 800)).toBeLessThan(dotCount(1280, 800));
    expect(dotCount(3840, 2160)).toBe(MAX_DOTS);
    expect(dotCount(100, 100)).toBe(12);
  });

  it("reads hex colours and falls back to amber", () => {
    expect(hexToRgb("#f59e0b")).toBe("245,158,11");
    expect(hexToRgb(" #0B1220 ")).toBe("11,18,32");
    expect(hexToRgb("oklch(1 0 0)")).toBe("245,158,11");
  });

  it("fades links with distance", () => {
    expect(linkAlpha(0, 0.2)).toBeCloseTo(0.2);
    expect(linkAlpha(LINK_DISTANCE / 2, 0.2)).toBeCloseTo(0.1);
    expect(linkAlpha(LINK_DISTANCE, 0.2)).toBe(0);
  });

  it("bounces a dot off the edges", () => {
    const dot = { x: 99, y: 50, vx: 5, vy: 0, r: 1 };
    stepDot(dot, 1, 100, 100);
    expect(dot.x).toBe(100);
    expect(dot.vx).toBe(-5);
  });
});
