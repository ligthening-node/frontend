/** The user's choice about the ambient background motion, remembered in localStorage. */
export const MOTION_KEY = "motion";

/** Only an explicit "off" turns it off, so a missing or odd value keeps the default (on). */
export function isMotionOff(stored: string | null | undefined): boolean {
  return stored === "off";
}
