import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

export function useAccessibilityPreferences() {
  // Start without motion or transparency until the system preference is known.
  const [reduceMotion, setReduceMotion] = useState(true);
  const [reduceTransparency, setReduceTransparency] = useState(true);

  useEffect(() => {
    let mounted = true;
    const updateMotion = (value: boolean) => {
      if (mounted) setReduceMotion(value);
    };
    const updateTransparency = (value: boolean) => {
      if (mounted) setReduceTransparency(value);
    };
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(updateMotion)
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      updateMotion,
    );
    const transparency =
      Platform.OS === "ios"
        ? AccessibilityInfo.addEventListener(
            "reduceTransparencyChanged",
            updateTransparency,
          )
        : undefined;
    if (Platform.OS === "ios") {
      void AccessibilityInfo.isReduceTransparencyEnabled()
        .then(updateTransparency)
        .catch(() => {});
    } else if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.matchMedia
    ) {
      const media = window.matchMedia("(prefers-reduced-transparency: reduce)");
      updateTransparency(media.matches);
      const listener = () => updateTransparency(media.matches);
      media.addEventListener("change", listener);
      return () => {
        mounted = false;
        motion.remove();
        media.removeEventListener("change", listener);
      };
    } else {
      // Android uses an opaque, inexpensive fallback; no native blur sampling.
      updateTransparency(false);
    }
    return () => {
      mounted = false;
      motion.remove();
      transparency?.remove();
    };
  }, []);

  return { reduceMotion, reduceTransparency };
}
