import type { ReactElement, ReactNode } from "react";

/**
 * Cross-fades two icons in place (opacity and a small scale, 150 ms) so a state change such as
 * copy to check is seen and not missed. Reduced motion makes the transition instant, so only the
 * final state shows.
 */
export function SwapIcon({ swapped, from, to }: { swapped: boolean; from: ReactNode; to: ReactNode }): ReactElement {
  const base = "absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-150 ease-out-strong";
  return (
    <span aria-hidden className="relative inline-flex size-4 items-center justify-center">
      <span className={`${base} ${swapped ? "scale-75 opacity-0" : "scale-100 opacity-100"}`}>{from}</span>
      <span className={`${base} ${swapped ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>{to}</span>
    </span>
  );
}
