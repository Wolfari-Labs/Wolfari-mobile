import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useEffect, useRef } from "react";

import type { DateTimePickerDialogProps } from "./date-time-picker.types";
import { minimumPickerDate, pickerText, pickerValue } from "./date-time-values";

/** Android shows the system Material dialog; nothing renders in the tree. */
export function DateTimePickerDialog(props: DateTimePickerDialogProps) {
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const { visible, mode } = props;
  useEffect(() => {
    if (!visible) return;
    // `title` is Material-3 only; the default dialog warns if it is passed.
    const { value, minimum } = latest.current;
    let settled = false;
    const close = () => {
      if (settled) return;
      settled = true;
      latest.current.onClose();
    };
    DateTimePickerAndroid.open({
      value: pickerValue(value, mode),
      mode,
      is24Hour: true,
      timeZoneName: "UTC",
      minimumDate: mode === "date" ? minimumPickerDate(minimum) : undefined,
      onValueChange: (_event, date) => {
        if (settled) return;
        latest.current.onConfirm(pickerText(date, mode));
        close();
      },
      onDismiss: close,
      onError: close,
    });
    return () => {
      if (!settled) void DateTimePickerAndroid.dismiss(mode);
    };
  }, [visible, mode]);
  return null;
}
