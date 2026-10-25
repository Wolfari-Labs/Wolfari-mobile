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
export function packingError(row: DraftRow) {
  if (!row.name?.trim() || row.name.trim().length > 200) return "Tên vật dụng cần từ 1 đến 200 ký tự.";
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(row.quantity ?? "") || Number(row.quantity.replace(",", ".")) <= 0 || Number(row.quantity.replace(",", ".")) > 100000) return "Số lượng phải lớn hơn 0, tối đa 100000 và 2 chữ số thập phân.";
  if (row.due && !validDate(row.due)) return "Hạn chuẩn bị cần là ngày hợp lệ YYYY-MM-DD.";
}
export function watchError(row: DraftRow) {
  if (!row.origin?.trim() || !row.destination?.trim() || normalizeText(row.origin) === normalizeText(row.destination)) return "Điểm đi và điểm đến phải khác nhau.";
  if (!validDate(row.departure ?? "")) return "Ngày đi cần đúng định dạng YYYY-MM-DD.";
  if (row.direction === "round" && (!validDate(row.returnDate ?? "") || row.returnDate < row.departure)) return "Ngày về phải hợp lệ và không trước ngày đi.";
  if (!/^[1-9]$/.test(row.passengers ?? "")) return "Số hành khách từ 1 đến 9.";
  if (!money(row.threshold ?? "")) return "Ngưỡng giá là số nguyên VND lớn hơn 0, tối đa 12 chữ số.";
}
export function fundError(row: DraftRow) {
  if (!row.name?.trim()) return "Nhập nội dung khoản dự kiến.";
  if (!money(row.amount ?? "")) return "Số tiền là số nguyên VND lớn hơn 0, tối đa 12 chữ số.";
  if (!validDate(row.date ?? "")) return "Ngày cần đúng định dạng YYYY-MM-DD.";
}
export function fundSummary(rows: DraftRow[]) {
  const total = (kind: string) => rows.filter(r => r.kind === kind).reduce((sum, r) => sum + (money(r.amount) ?? 0), 0);
  const contributions = total("contribution"), expenses = total("expense"), refunds = total("refund");
  return { contributions, expenses, refunds, balance: contributions - expenses, available: contributions - expenses - refunds };
}
export type CreateDraft = {
  name: string; start: string; end: string; description: string; destination: string;
  members: string; budget: string; style: string; template: string; cover: string;
};
export const emptyCreateDraft: CreateDraft = { name: "", start: "", end: "", description: "", destination: "", members: "2", budget: "", style: "explore", template: "blank", cover: "tripCover" };
export function isCreateDraft(value: unknown): value is CreateDraft {
  return isRecord(value) && Object.keys(emptyCreateDraft).every(key => typeof value[key] === "string" && (value[key] as string).length <= 5000);
}
