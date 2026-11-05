import { StyleSheet } from "react-native";
import Animated, { cubicBezier } from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors } from "@/shared/theme/tokens";
import { DesignIcon } from "./design-icon";

/** State feedback only. The parent owns the checkbox semantics and touch target. */
export function PackingCheck({ checked }: { checked: boolean }) {
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <Animated.View accessible={false} style={[
      styles.box,
      {
        backgroundColor: checked ? colors.pinGreen : colors.surface,
        // A checked box gets "stamped": it pops a little, then settles.
        transform: [{ scale: checked && !reduceMotion ? 1 : 1 }, { rotate: checked && !reduceMotion ? "-4deg" : "0deg" }],
        transitionProperty: ["backgroundColor", "transform"],
        transitionDuration: reduceMotion ? 0 : 160,
        transitionTimingFunction: cubicBezier(0.34, 1.56, 0.64, 1),
      },
    ]}>
      <Animated.View style={{
        opacity: checked ? 1 : 0,
        transform: [{ scale: checked || reduceMotion ? 1 : 0.4 }],
        transitionProperty: ["opacity", "transform"],
        transitionDuration: reduceMotion ? 0 : 160,
        transitionTimingFunction: cubicBezier(0.34, 1.56, 0.64, 1),
      }}>
        <DesignIcon name="check" size={18} tintColor={colors.surface} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { width: 28, height: 28, borderRadius: 8, borderCurve: "continuous", borderWidth: 1.5, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
});
