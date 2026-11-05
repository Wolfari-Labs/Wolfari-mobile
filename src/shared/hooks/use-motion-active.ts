import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useAccessibilityPreferences } from "./use-accessibility-preferences";

/** Decorative motion is allowed only on the focused, foreground screen. */
export function useMotionActive() {
  const { reduceMotion } = useAccessibilityPreferences();
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  return focused && foreground && !reduceMotion;
}
