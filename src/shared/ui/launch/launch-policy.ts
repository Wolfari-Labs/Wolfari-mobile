export const launchTiming = {
  intro: 1200,
  maximum: 2400,
  reducedMaximum: 900,
  assetGrace: 650,
  preferenceGrace: 450,
  exit: 260,
  safety: 4000,
} as const;

/** Session restoration runs in parallel. A slow/offline API must not trap launch. */
export function remainingLaunchTime(elapsed: number, sessionReady: boolean, reduceMotion: boolean) {
  const target = reduceMotion
    ? sessionReady ? 0 : launchTiming.reducedMaximum
    : sessionReady ? launchTiming.intro : launchTiming.maximum;
  return Math.max(0, target - Math.max(0, elapsed));
}
