import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, typography } from "@/shared/theme/tokens";
import type { DateTimeFieldProps } from "./date-time-field.types";
import { DateTimePickerDialog } from "./date-time-picker";
import { DesignIcon } from "./design-icon";

export function DateTimeField({
  label,
  value,
  onChangeText,
  mode = "date",
  minimum,
  editable = true,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || "Chưa chọn" }}
        accessibilityHint={
          mode === "date" ? "Mở bộ chọn ngày" : "Mở bộ chọn giờ"
        }
        accessibilityState={{ disabled: !editable }}
        disabled={!editable}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.control,
          (pressed || !editable) && { opacity: 0.55 },
        ]}
      >
        <View style={styles.icon}>
          <DesignIcon
            name={mode === "date" ? "calendar" : "clock"}
            size={18}
            tintColor={colors.teal}
          />
        </View>
        <Text
          style={[
            typography.body,
            styles.value,
            !value && { color: colors.muted },
          ]}
        >
          {value || (mode === "date" ? "Chọn ngày" : "Chọn giờ")}
        </Text>
        <DesignIcon name="chevron" size={16} tintColor={colors.muted} />
      </Pressable>
      <DateTimePickerDialog
        visible={open}
        title={label}
        mode={mode}
        value={value}
        minimum={minimum}
        onConfirm={onChangeText}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: "700" },
  control: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.control,
    backgroundColor: colors.fill,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: { width: 32, height: 32, borderRadius: 12, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  value: { flex: 1, minWidth: 0 },
});
