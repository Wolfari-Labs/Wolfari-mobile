import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { colors } from "@/shared/theme/tokens";
import type { DateTimeFieldProps } from "./date-time-field.types";
import { DateTimePickerDialog } from "./date-time-picker";
import { DesignIcon } from "./design-icon";
import { FormField } from "./form-field";

// Web keeps typed entry (paste, keyboard users) and adds a picker popup.
export function DateTimeField({ mode = "date", minimum, ...props }: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const disabled = props.editable === false;
  return (
    <>
      <FormField
        {...props}
        icon={mode === "date" ? "calendar" : "clock"}
        placeholder={mode === "date" ? "DD/MM/YYYY" : "HH:mm"}
        maxLength={mode === "date" ? 10 : 5}
        keyboardType="numbers-and-punctuation"
        accessory={
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel={`Mở bộ chọn ${props.label.toLowerCase()}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => setOpen(true)}
            style={({ pressed }) => [styles.open, pressed && { backgroundColor: colors.tealSoft }]}
          >
            <DesignIcon name="chevron" size={16} tintColor={colors.teal} />
          </Pressable>
        }
      />
      <DateTimePickerDialog
        visible={open}
        title={props.label}
        mode={mode}
        value={props.value}
        minimum={minimum}
        onConfirm={props.onChangeText}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  open: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
});
