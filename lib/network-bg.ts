/** Pure helpers for the animated background, kept apart from the canvas so they can be tested. */

export interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export const LINK_DISTANCE = 150;
export const MAX_DOTS = 55;
const AREA_PER_DOT = 26000;

/** How many dots fit a viewport: sparse on phones, capped so large screens stay cheap. */
export function dotCount(width: number, height: number): number {
  return Math.max(12, Math.min(MAX_DOTS, Math.round((width * height) / AREA_PER_DOT)));
}

/** "#f59e0b" -> "245,158,11". Falls back to amber when the value is not a 6-digit hex colour. */
export function hexToRgb(hex: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (match === null) {
    return "245,158,11";
  }
  return [match[1], match[2], match[3]].map((part: string): number => parseInt(part, 16)).join(",");
}

/** Link opacity: strongest when two dots touch, gone at LINK_DISTANCE. */
export function linkAlpha(distance: number, strength: number): number {
  return distance >= LINK_DISTANCE ? 0 : (1 - distance / LINK_DISTANCE) * strength;
}

/** Moves a dot by `dt` frames at 60 fps and bounces it off the viewport edges. */
export function stepDot(dot: Dot, dt: number, width: number, height: number): void {
  dot.x += dot.vx * dt;
  dot.y += dot.vy * dt;
  if (dot.x < 0 || dot.x > width) {
    dot.vx = -dot.vx;
    dot.x = Math.min(Math.max(dot.x, 0), width);
  }
  if (dot.y < 0 || dot.y > height) {
    dot.vy = -dot.vy;
    dot.y = Math.min(Math.max(dot.y, 0), height);
  }
}
