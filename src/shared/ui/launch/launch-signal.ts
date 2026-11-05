import { useSyncExternalStore } from "react";

// The launch cover hides the navigator with display:none. Entrance animations
// must wait until the cover starts to lift, or they would finish unseen.
let revealed = false;
const listeners = new Set<() => void>();

export function markLaunchRevealed() {
  if (revealed) return;
  revealed = true;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** True once the app launch cover has begun to exit (always true on the server). */
export function useLaunchRevealed() {
  return useSyncExternalStore(subscribe, () => revealed, () => true);
}
