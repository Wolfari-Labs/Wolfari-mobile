import { FormField } from "./form-field";
import type { DateTimeFieldProps } from "./date-time-field.types";

export function DateTimeField({ mode = "date", ...props }: DateTimeFieldProps) {
  return (
    <FormField
      {...props}
      icon={mode === "date" ? "calendar" : "clock"}
      placeholder={mode === "date" ? "DD/MM/YYYY" : "HH:mm"}
      maxLength={mode === "date" ? 10 : 5}
      keyboardType="numbers-and-punctuation"
    />
  );
}
