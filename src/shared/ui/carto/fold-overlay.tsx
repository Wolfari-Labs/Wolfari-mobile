import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";

/** Three soft panels over a photo, like a paper map folded in thirds. */
export function FoldOverlay() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[
        "rgba(23,63,99,0.10)", "rgba(23,63,99,0.03)",
        "rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)",
        "rgba(23,63,99,0.12)", "rgba(23,63,99,0.04)",
      ]}
      locations={[0, 0.333, 0.334, 0.666, 0.667, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
