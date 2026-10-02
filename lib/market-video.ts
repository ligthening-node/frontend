/** Why the background video may not play. Any one of these keeps it paused on its poster frame. */
export interface PlaybackBlockers {
  reducedMotion: boolean;
  motionOff: boolean;
  saveData: boolean;
  hidden: boolean;
}

export function shouldPlayVideo(blockers: PlaybackBlockers): boolean {
  return !(blockers.reducedMotion || blockers.motionOff || blockers.saveData || blockers.hidden);
}

/** `navigator.connection` is not in the DOM typings yet, so it is read through a narrow cast. */
export function prefersSavingData(nav: object): boolean {
  return (nav as { connection?: { saveData?: boolean } }).connection?.saveData === true;
}
