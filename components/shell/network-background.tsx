"use client";

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import { dotCount, hexToRgb, linkAlpha, stepDot } from "@/lib/network-bg";
import type { Dot } from "@/lib/network-bg";

const SPEED = 0.22;
const PULSE_EVERY_MS = 2200;
const PULSE_MS = 1400;
const MAX_DPR = 2;

interface Pulse {
  from: Dot;
  to: Dot;
  startedAt: number;
}

function cssColor(name: string): string {
  return hexToRgb(getComputedStyle(document.documentElement).getPropertyValue(name));
}

/**
 * A faint Lightning-network backdrop: nodes drift, nearby ones link up, and now and then a pulse
 * travels along a link like a payment. It sits behind the content and never takes input. It stops
 * when the tab is hidden and draws one still frame when the user prefers reduced motion.
 */
export function NetworkBackground(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect((): (() => void) | undefined => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas === null || canvas === undefined || ctx === null || ctx === undefined) {
      return undefined;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let dots: Dot[] = [];
    let pulses: Pulse[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = 0;
    let lastPulse = 0;
    let line = "148,163,184";
    let glow = "245,158,11";

    const readColors = (): void => {
      line = cssColor("--muted-foreground");
      glow = cssColor("--primary");
    };

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const wanted = dotCount(width, height);
      while (dots.length < wanted) {
        const angle = Math.random() * Math.PI * 2;
        dots.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * SPEED * (0.4 + Math.random()),
          vy: Math.sin(angle) * SPEED * (0.4 + Math.random()),
          r: 1.2 + Math.random() * 1.4,
        });
      }
      dots = dots.slice(0, wanted);
      pulses = [];
    };

    const draw = (now: number): void => {
      ctx.clearRect(0, 0, width, height);
      const linked: [Dot, Dot][] = [];
      for (let i = 0; i < dots.length; i += 1) {
        for (let j = i + 1; j < dots.length; j += 1) {
          const distance = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y);
          const alpha = linkAlpha(distance, 0.16);
          if (alpha > 0) {
            ctx.strokeStyle = `rgba(${line},${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
            linked.push([dots[i], dots[j]]);
          }
        }
      }
      for (const dot of dots) {
        ctx.fillStyle = `rgba(${glow},0.4)`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fill();
      }
      pulses = pulses.filter((pulse: Pulse): boolean => now - pulse.startedAt < PULSE_MS);
      for (const pulse of pulses) {
        const t = (now - pulse.startedAt) / PULSE_MS;
        const x = pulse.from.x + (pulse.to.x - pulse.from.x) * t;
        const y = pulse.from.y + (pulse.to.y - pulse.from.y) * t;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 9);
        gradient.addColorStop(0, `rgba(${glow},0.85)`);
        gradient.addColorStop(1, `rgba(${glow},0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      if (linked.length > 0 && now - lastPulse > PULSE_EVERY_MS) {
        const [from, to] = linked[Math.floor(Math.random() * linked.length)];
        pulses.push({ from, to, startedAt: now });
        lastPulse = now;
      }
    };

    const tick = (now: number): void => {
      const dt = lastTime === 0 ? 1 : Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;
      for (const dot of dots) {
        stepDot(dot, dt, width, height);
      }
      draw(now);
      frame = requestAnimationFrame(tick);
    };

    const stop = (): void => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    };

    const start = (): void => {
      stop();
      if (reduceMotion.matches || document.hidden || document.documentElement.dataset.motion === "off") {
        draw(performance.now());
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    // A theme change recolours the frame; the motion toggle starts or stops the loop.
    const themeObserver = new MutationObserver((): void => {
      readColors();
      start();
    });

    readColors();
    resize();
    start();
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-motion"] });
    const onResize = (): void => {
      resize();
      start();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", start);
    reduceMotion.addEventListener("change", start);
    return (): void => {
      stop();
      themeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", start);
      reduceMotion.removeEventListener("change", start);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
