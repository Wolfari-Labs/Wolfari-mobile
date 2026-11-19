// UTC is a carrier for calendar values, not the trip's timezone. API conversion
// still happens in localTimestamp using the trip's IANA zone.
export function pickerValue(
  value: string,
  mode: "date" | "time",
  now = new Date(),
): Date {
  if (mode === "time") {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    return new Date(
      Date.UTC(2000, 0, 1, match ? +match[1] : 8, match ? +match[2] : 0),
    );
  }
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (match && +match[3] >= 2000) {
    const date = new Date(Date.UTC(+match[3], +match[2] - 1, +match[1], 12));
    if (date.getUTCDate() === +match[1] && date.getUTCMonth() === +match[2] - 1)
      return date;
  }
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12),
  );
}

/** Monday-first month grid; null cells pad the first week. */
export function monthCells(year: number, month: number): (number | null)[] {
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: count }, (_, index) => index + 1),
  ];
}

/** Lower bound for a date picker from DD/MM/YYYY; undefined when absent or invalid. */
export function minimumPickerDate(value?: string): Date | undefined {
  if (!value || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return;
  const date = pickerValue(value, "date");
  return pickerText(date, "date") === value ? date : undefined;
}

export function pickerText(date: Date, mode: "date" | "time"): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return mode === "date"
    ? `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`
    : `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
