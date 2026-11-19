import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Text } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "./button";
import type { DateTimePickerDialogProps } from "./date-time-picker.types";
import { minimumPickerDate, pickerText, pickerValue } from "./date-time-values";
import { Sheet } from "./sheet";

export function DateTimePickerDialog({
  visible,
  title,
  mode,
  value,
  minimum,
  onConfirm,
  onClose,
}: DateTimePickerDialogProps) {
  const [draft, setDraft] = useState(() => pickerValue(value, mode));
  const [openedWith, setOpenedWith] = useState<string>();
  // Re-seed the wheel from the field each time the sheet opens.
  if (visible && openedWith !== value) {
    setOpenedWith(value);
    setDraft(pickerValue(value, mode));
  } else if (!visible && openedWith !== undefined) setOpenedWith(undefined);
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Text style={[typography.title, { textAlign: "center" }]}>
        {pickerText(draft, mode)}
      </Text>
      <DateTimePicker
        value={draft}
        mode={mode}
        display={mode === "date" ? "inline" : "spinner"}
        locale="vi-VN"
        timeZoneName="UTC"
        themeVariant="light"
        textColor={colors.ink}
        accentColor={colors.teal}
        minimumDate={
          mode === "date"
            ? (minimumPickerDate(minimum) ?? new Date("2000-01-01T00:00:00Z"))
            : undefined
        }
        onValueChange={(_event, date) => setDraft(date)}
        accessibilityLabel={title}
        style={{ alignSelf: "stretch" }}
      />
      <Button
        label="Xong"
        onPress={() => {
          onConfirm(pickerText(draft, mode));
          onClose();
        }}
      />
    </Sheet>
  );
}
