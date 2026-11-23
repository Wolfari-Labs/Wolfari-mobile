import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import type { DesignIconName } from "./design-assets";
import { RowIcon, type RowTone } from "./settings-list";

/**
 * One option of a single choice, as a full-width card: icon, title, one line of what it
 * means, and a radio mark. Clearer than a segmented control when options need explaining.
 */
export function ChoiceCard({
  title,
  description,
  icon,
  tone = "blue",
  selected,
  onPress,
  disabled = false,
  danger = false,
}: {
  title: string;
  description?: string;
  icon?: DesignIconName;
  tone?: RowTone;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const accent = danger ? colors.error : colors.teal;
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ selected, checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && { borderColor: accent, backgroundColor: danger ? colors.errorSurface : colors.tealSoft },
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon && <RowIcon icon={icon} tone={danger ? "danger" : tone} size={38} />}
      <View style={styles.copy}>
        <Text style={[styles.title, danger && { color: colors.error }]}>{title}</Text>
        {description && <Text style={typography.footnote}>{description}</Text>}
      </View>
      <View style={[styles.radio, selected && { borderColor: accent }]}>
        {selected && <View style={[styles.dot, { backgroundColor: accent }]} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    minHeight: 68,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: "transparent",
    ...shadows.glass,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: colors.ink },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
