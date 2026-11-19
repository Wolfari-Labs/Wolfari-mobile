export type DateTimeFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  mode?: "date" | "time";
  /** Earliest selectable date as DD/MM/YYYY (date mode only). */
  minimum?: string;
  editable?: boolean;
};
