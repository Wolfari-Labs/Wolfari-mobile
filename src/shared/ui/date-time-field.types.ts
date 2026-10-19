export type DateTimeFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  mode?: "date" | "time";
  editable?: boolean;
};
