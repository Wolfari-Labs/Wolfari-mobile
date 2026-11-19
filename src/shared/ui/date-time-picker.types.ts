export type DateTimePickerDialogProps = {
  visible: boolean;
  title: string;
  mode: "date" | "time";
  /** DD/MM/YYYY or HH:mm; an empty or invalid value opens on today / 08:00. */
  value: string;
  /** Earliest selectable date as DD/MM/YYYY (date mode only). */
  minimum?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
};
