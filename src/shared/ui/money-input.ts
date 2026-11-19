/** Keeps only digits so callers store the raw VND string their parsers expect. */
export function moneyDigits(input: string, maxDigits = 19): string {
  return input.replace(/\D/g, "").slice(0, maxDigits);
}

/** Groups thousands with "." for display; never changes the digits themselves. */
export function groupMoney(raw: string): string {
  return moneyDigits(raw).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Short spoken-style hint such as "1,5 triệu" or "250 nghìn"; undefined below 1.000. */
export function moneyWords(raw: string): string | undefined {
  const digits = moneyDigits(raw).replace(/^0+/, "");
  if (digits.length < 4 || digits.length > 15) return;
  const value = Number(digits);
  const [unit, size] =
    value >= 1e9 ? ["tỷ", 1e9] : value >= 1e6 ? ["triệu", 1e6] : ["nghìn", 1e3];
  const scaled = Math.floor((value / size) * 100) / 100;
  return `${scaled.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${unit}`;
}
