/** "0866706255" → "0866 706 255": easier to read aloud and compare with a banking app. */
export function groupAccount(value: string) {
  const digits = value.replace(/\s+/g, "");
  if (!/^\d{7,}$/.test(digits)) return digits;
  const head = digits.length % 3 === 1 ? 4 : digits.length % 3 === 2 ? 5 : 3;
  return [digits.slice(0, head), ...(digits.slice(head).match(/\d{3}/g) ?? [])].join(" ");
}
