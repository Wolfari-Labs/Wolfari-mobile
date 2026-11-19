import { useEffect, useState } from "react";

/** Seconds left before another code may be requested; 0 when allowed. */
export function useResendCooldown(seconds = 60, justSent = false) {
  // A screen opened right after a code was sent starts already waiting.
  const [until, setUntil] = useState(() => (justSent ? Date.now() + seconds * 1000 : 0));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return {
    left: Math.max(0, Math.ceil((until - now) / 1000)),
    start: () => {
      const at = Date.now();
      setNow(at);
      setUntil(at + seconds * 1000);
    },
  };
}
