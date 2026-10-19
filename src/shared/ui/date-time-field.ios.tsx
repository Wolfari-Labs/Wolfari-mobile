import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, typography } from "@/shared/theme/tokens";
import { Button } from "./button";
import type { DateTimeFieldProps } from "./date-time-field.types";
import { pickerText, pickerValue } from "./date-time-values";
import { DesignIcon } from "./design-icon";
import { Sheet } from "./sheet";

export function DateTimeField({
  label,
  value,
  onChangeText,
  mode = "date",
  editable = true,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => pickerValue(value, mode));
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
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
          setDraft(pickerValue(value, mode));
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.control,
          (pressed || !editable) && { opacity: 0.55 },
        ]}
      >
        <DesignIcon
          name={mode === "date" ? "calendar" : "clock"}
          size={18}
          tintColor={colors.teal}
        />
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
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        <Text style={[typography.title, { textAlign: "center" }]}>
          {pickerText(draft, mode)}
        </Text>
        <DateTimePicker
          value={draft}
          mode={mode}
          display="spinner"
          locale="vi-VN"
          timeZoneName="UTC"
          themeVariant="light"
          textColor={colors.ink}
          minimumDate={
            mode === "date" ? new Date("2000-01-01T00:00:00Z") : undefined
          }
          onValueChange={(_event, date) => setDraft(date)}
          accessibilityLabel={label}
          style={{ alignSelf: "stretch" }}
        />
        <Button
          label="Xong"
          onPress={() => {
            onChangeText(pickerText(draft, mode));
            setOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: "500" },
  control: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  value: { flex: 1, minWidth: 0 },
});
