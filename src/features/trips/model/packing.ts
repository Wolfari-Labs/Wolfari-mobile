import type { Membership, PackingInput, PackingItem } from "../types";
import { dateLabel, localTimestamp, parseDate } from "../utils.ts";

export type PackingForm = {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  note: string;
  category: string;
  assignee: string;
  due: string;
  originalDueAt?: string | null;
};
export function packingForm(item: PackingItem | undefined, timezone: string): PackingForm {
  return {
    id: item?.id,
    name: item?.name ?? "",
    quantity: item?.quantity ?? "1",
    unit: item?.unit ?? "món",
    note: item?.note ?? "",
    category: item?.category ?? "Khác",
    assignee: item?.assigned_member_id ?? "",
    due: item?.due_at ? dateLabel(item.due_at, timezone) : "",
    originalDueAt: item?.due_at,
  };
}
export function packingInput(
  form: PackingForm,
  context: { members: Membership[]; timezone: string; planVersion: number },
): PackingInput {
  const text = (value: string, max: number, label: string) => {
    const clean = value.trim();
    if (clean.includes("\0") || [...clean].length > max)
      throw Error(`${label} tối đa ${max} ký tự.`);
    return clean || null;
  };
  const name = text(form.name, 200, "Tên vật dụng");
  if (!name) throw Error("Nhập tên vật dụng.");
  const quantity = form.quantity.trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(quantity) || Number(quantity) <= 0)
    throw Error("Số lượng phải lớn hơn 0, tối đa 8 chữ số và 2 chữ số thập phân.");
  if (
    form.assignee &&
    !context.members.some((member) => member.id === form.assignee && !member.left_at)
  )
    throw Error("Chọn thành viên đang tham gia để phân công.");
  const due = form.due.trim();
  const date = due ? parseDate(due) : undefined;
  const due_at =
    due && form.originalDueAt && due === dateLabel(form.originalDueAt, context.timezone)
      ? form.originalDueAt
      : date
        ? (localTimestamp(date, "23:59", context.timezone) ?? null)
        : null;
  if (due && !due_at) throw Error("Chọn hạn chuẩn bị hợp lệ.");
  return {
    name,
    quantity,
    unit: text(form.unit, 30, "Đơn vị"),
    note: text(form.note, 5000, "Ghi chú"),
    category: text(form.category, 80, "Danh mục"),
    assigned_member_id: form.assignee || null,
    due_at,
    expected_plan_version: context.planVersion,
  };
}

export const PACKING_CATEGORIES = ["Quần áo", "Vệ sinh", "Giấy tờ", "Điện tử", "Y tế", "Ăn uống", "Khác"];
export const PACKING_UNITS = ["cái", "món", "bộ", "đôi", "chai", "hộp", "gói"];

/** "1.50" + "chai" → "1,5 chai"; whole numbers drop the decimals. */
export function quantityLabel(quantity: string, unit: string | null): string {
  const value = Number(quantity);
  const amount = Number.isFinite(value)
    ? value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })
    : quantity;
  return unit?.trim() ? `${amount} ${unit.trim()}` : amount;
}
