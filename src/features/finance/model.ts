import type { Contribution, Destination, Expense, Fund, Refund } from "./types";

const maxMoney = "9223372036854775807";
export function parseMoney(input: string, zero = false): string {
  const value = input.trim();
  if (!/^[0-9]+$/.test(value)) throw new Error("Nhập số tiền VND nguyên, chỉ gồm chữ số (không dấu chấm/phẩy).");
  const canonical = value.replace(/^0+/, "") || "0";
  if ((!zero && canonical === "0") || canonical.length > maxMoney.length || (canonical.length === maxMoney.length && canonical > maxMoney))
    throw new Error("Số tiền phải dương và không vượt 9223372036854775807 VND.");
  return canonical;
}
export function money(value: string | null): string {
  if (value === null) return "Chưa đặt";
  return `${value.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫`;
}
export function requiredText(value: string, label: string, max = 1024): string {
  const text = value.trim();
  if (!text || text.includes("\0") || [...text].length > max) throw new Error(`${label} cần từ 1 đến ${max} ký tự, không chứa ký tự không hợp lệ.`);
  return text;
}
export function eligibleDestinations(rows: Destination[]) {
  return rows.filter(row => row.active && !!row.confirmed_by_holder_at && ["VIETQR", "MOMO_SANDBOX"].includes(row.destination_type));
}
export type FinanceActor = { userId: string; owner: boolean; writable: boolean; holder: boolean };
export function financeActor(fund: Fund, userId: string, owner: boolean, archived: boolean): FinanceActor {
  return { userId, owner, writable: fund.status === "OPEN" && !archived, holder: fund.holder_user_id === userId };
}
export function contributionActions(row: Contribution, actor: FinanceActor) {
  if (!actor.writable) return [];
  const actions: ("amount" | "waive" | "cancel" | "report-transfer" | "confirm-received" | "reject-transfer" | "reverse")[] = [];
  if (row.status === "PENDING") {
    if (actor.owner) actions.push("amount", "waive", "cancel");
    if (row.member_user_id === actor.userId) actions.push("report-transfer");
  }
  if (row.status === "TRANSFER_REPORTED" && actor.holder) actions.push("confirm-received", "reject-transfer");
  if (row.status === "CONFIRMED" && actor.holder) actions.push("reverse");
  return actions;
}
export function expenseActions(row: Expense, actor: FinanceActor) {
  if (!actor.writable) return [];
  const actions: ("edit" | "delete" | "submit" | "withdraw" | "confirm" | "reject" | "reverse")[] = [];
  if (row.status === "DRAFT" && (actor.owner || row.created_by_user_id === actor.userId)) actions.push("edit", "delete", "submit");
  if (row.status === "SUBMITTED") {
    if (row.created_by_user_id === actor.userId) actions.push("withdraw");
    if (actor.holder) actions.push("confirm", "reject");
  }
  if (row.status === "CONFIRMED" && actor.holder) actions.push("reverse");
  return actions;
}
/** Trip context the refund verification rule needs; omit it to keep the recipient-only rule. */
export type RefundContext = { holderUserId: string; ownerUserId: string | null; activeMemberCount: number };
/**
 * Mirrors the Backend rule (FR-FN07): the payer (Holder) never verifies their own refund alone.
 * Recipient ≠ Holder → recipient; recipient = Holder ≠ Owner → Owner; Owner = Holder = recipient →
 * the member the Owner assigned (single-member Trip: self, without independent verification).
 * Display hint only; the server stays authoritative (after a handover it keeps the original payer).
 */
export function refundConfirmer(row: Refund, ctx: RefundContext): string | null {
  if (row.member_user_id !== ctx.holderUserId) return row.member_user_id;
  if (ctx.ownerUserId && ctx.ownerUserId !== ctx.holderUserId) return ctx.ownerUserId;
  if (ctx.activeMemberCount === 1) return ctx.holderUserId;
  return row.verifier_user_id ?? null;
}
export function refundNeedsVerifier(row: Refund, ctx: RefundContext) {
  return row.member_user_id === ctx.holderUserId && ctx.ownerUserId === ctx.holderUserId && ctx.activeMemberCount > 1
    && (row.status === "PENDING" || row.status === "HOLDER_REPORTED");
}
export function refundActions(row: Refund, actor: FinanceActor, ctx?: RefundContext) {
  if (!actor.writable) return [];
  const actions: ("assign-verifier" | "report-paid" | "confirm-received" | "confirm-nonreceipt" | "cancel" | "request-reversal" | "consent-reversal" | "reverse")[] = [];
  const self = row.member_user_id === actor.userId;
  if (ctx && actor.owner && refundNeedsVerifier(row, ctx)) actions.push("assign-verifier");
  if (row.status === "PENDING") {
    if (actor.holder) actions.push("report-paid");
    if (actor.owner) actions.push("cancel");
  }
  if (row.status === "HOLDER_REPORTED") {
    if (ctx ? refundConfirmer(row, ctx) === actor.userId : self) actions.push("confirm-received");
    if (self) actions.push("confirm-nonreceipt");
    if (actor.owner && row.nonreceipt_confirmed_at) actions.push("cancel");
  }
  if (row.status === "CONFIRMED") {
    if (actor.holder && !row.reversal_requested_at) actions.push("request-reversal");
    if (self && row.reversal_requested_at && !row.reversal_consented_at) actions.push("consent-reversal");
    if (actor.holder && row.reversal_requested_at && row.reversal_consented_at) actions.push("reverse");
  }
  return actions;
}
export const statusLabels: Record<string, string> = {
  OPEN: "Đang mở", CLOSING: "Đang chốt", CLOSED: "Đã đóng", PENDING: "Đang chờ",
  TRANSFER_REPORTED: "Đã báo chuyển · chờ người giữ quỹ", CONFIRMED: "Đã xác nhận",
  WAIVED: "Được miễn", CANCELLED: "Đã hủy", REVERSED: "Đã đảo sổ", DRAFT: "Nháp trên máy chủ",
  SUBMITTED: "Chờ duyệt", REJECTED: "Bị từ chối", HOLDER_REPORTED: "Đã báo hoàn · chờ người nhận",
  PENDING_CONFIRMATIONS: "Chờ thành viên xác nhận", COMPLETED: "Hoàn tất",
};
