export type DraftRow = { id: string; [field: string]: string };
export type CollectionDraft = { base: string; rows: DraftRow[]; history: string[] };
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function isRow(value: unknown): value is DraftRow {
  return isRecord(value) && typeof value.id === "string" && !!value.id &&
    Object.keys(value).length <= 40 && Object.values(value).every(v => typeof v === "string" && v.length <= 5000);
}
export function isCollection(value: unknown): value is CollectionDraft {
  return isRecord(value) && typeof value.base === "string" && value.base.length <= 100_000 &&
    Array.isArray(value.rows) && value.rows.length <= 500 && value.rows.every(isRow) &&
    new Set(value.rows.map(row => row.id)).size === value.rows.length &&
    Array.isArray(value.history) && value.history.length <= 100 &&
    value.history.every(v => typeof v === "string" && v.length <= 6000);
}
export function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();
}
export function money(value: string): number | null {
  if (!/^\d{1,12}$/.test((value ?? "").trim())) return null;
  const number = Number(value);
  return number > 0 && Number.isSafeInteger(number) ? number : null;
}
export function moneyLabel(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + "T12:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value && value >= "2000-01-01";
}
export type CreateDraft = {
  name: string; start: string; end: string; description: string; destination: string;
  members: string; budget: string; style: string; template: string; cover: string; timezone?: string;
};
export const emptyCreateDraft: CreateDraft = { name: "", start: "", end: "", description: "", destination: "", members: "2", budget: "", style: "", template: "blank", cover: "tripCover" };
export function isCreateDraft(value: unknown): value is CreateDraft {
  return isRecord(value) && (value.timezone === undefined || (typeof value.timezone === "string" && value.timezone.length <= 64)) && Object.keys(emptyCreateDraft).every(key => typeof value[key] === "string" && (value[key] as string).length <= 5000);
}
