import type { Membership } from "../trips/types";
import { financeCommands as commands } from "./api.ts";
import type { FinanceFormSpec } from "./components/finance-form";
import { eligibleDestinations, money, parseMoney, requiredText } from "./model.ts";
import { dateLabel, timeLabel, parseDate, localTimestamp } from "../trips/utils.ts";
import type { Closure, Contribution, Destination, Expense, Fund, Refund } from "./types";

const amountField = { key: "amount", label: "Số tiền (VND, chỉ chữ số)", numeric: true, max: 19 };
const reasonField = { key: "reason", label: "Lý do", multiline: true, max: 1024 };
const titleField = { key: "title", label: "Nội dung", max: 200 };
const text = requiredText;
const memberOptions = (members: Membership[], self: string) => members.filter(member => !member.left_at).map(member => ({ value: member.user_id, label: `${member.user_id === self ? "Bạn" : member.role === "OWNER" ? "Chủ nhóm" : "Thành viên"} · ${member.user_id.slice(0, 8)}` }));
const bankFields = [
  { key: "bank_code", label: "Mã ngân hàng (VD: VCB)", max: 30 },
  { key: "account_number", label: "Số tài khoản", max: 80 },
  { key: "account_name", label: "Tên chủ tài khoản", max: 150 },
];
const bankInput = (values: Record<string, string>) => ({ destination_type: "VIETQR" as const,
  bank_code: text(values.bank_code ?? "", "Mã ngân hàng", 30), account_number: text(values.account_number ?? "", "Số tài khoản", 80),
  account_name: text(values.account_name ?? "", "Tên chủ tài khoản", 150), active: true, is_default: true });
const reasonDescription = "Bắt buộc nêu lý do. Thao tác giữ nguyên lịch sử; đảo sổ không tự trả lại tiền ngân hàng.";
export const actionLabels: Record<string, string> = {
  amount: "Sửa số tiền", waive: "Miễn đóng góp", cancel: "Hủy", "report-transfer": "Báo đã chuyển tiền", "confirm-received": "Xác nhận đã nhận đủ",
  "reject-transfer": "Từ chối báo chuyển", reverse: "Đảo giao dịch", edit: "Sửa khoản chi", delete: "Xóa khoản chi nháp",
  submit: "Gửi duyệt khoản chi", withdraw: "Rút đề nghị chi", confirm: "Xác nhận đã chi", reject: "Từ chối khoản chi",
  "report-paid": "Báo đã hoàn tiền", "confirm-nonreceipt": "Báo chưa nhận tiền", "request-reversal": "Yêu cầu đảo hoàn tiền", "consent-reversal": "Đồng ý đảo hoàn tiền",
};
export function enableForm(tripId: string, members: Membership[], self: string): FinanceFormSpec {
  return { title: "Mở quỹ nhóm", description: "Chọn người giữ quỹ và tài khoản nhận. Người giữ quỹ phải xác nhận tài khoản riêng sau khi mở; chưa có tiền được thu ở bước này.",
    initial: { holder: self }, fields: [{ key: "holder", label: "Người giữ quỹ", options: memberOptions(members, self) }, { ...amountField, key: "budget", label: "Ngân sách dự kiến (VND, có thể để trống)" }, ...bankFields],
    build: values => { if (!members.some(member => member.user_id === values.holder && !member.left_at)) throw new Error("Chọn người giữ quỹ đang tham gia."); return commands.enable(tripId, values.holder, bankInput(values), values.budget?.trim() ? parseMoney(values.budget, true) : undefined); } };
}
export function budgetForm(fund: Fund): FinanceFormSpec {
  return { title: "Cập nhật ngân sách", description: "Ngân sách là dự kiến, không thay đổi số dư đã xác nhận. Để trống để bỏ ngân sách.", initial: { amount: fund.budget_amount ?? "" }, fields: [amountField], build: values => commands.budget(fund, values.amount?.trim() ? parseMoney(values.amount, true) : null) };
}
export function destinationForm(fund: Fund, row?: Destination): FinanceFormSpec {
  return { title: row ? "Sửa tài khoản nhận" : "Thêm tài khoản nhận", description: "Tài khoản VietQR mới/sửa sẽ cần người giữ quỹ xác nhận. Chỉ dẫn của các khoản đóng góp đã phát hành không đổi. Tài khoản này sẽ được đặt mặc định cho yêu cầu mới.",
    initial: { bank_code: row?.bank_code ?? "", account_number: row?.account_number ?? "", account_name: row?.account_name ?? "" }, fields: bankFields,
    build: values => commands.destination(fund, bankInput(values), row) };
}
export function contributionRequestForm(fund: Fund, members: Membership[], destinations: Destination[], self: string): FinanceFormSpec {
  const eligible = eligibleDestinations(destinations);
  return { title: "Tạo yêu cầu đóng góp", description: "Số tiền nhập áp dụng cho mỗi người đã chọn, không phải tổng chia đều. Chỉ dùng tài khoản VietQR đã được người giữ quỹ xác nhận.",
    initial: { members: "", destination: eligible.find(row => row.is_default)?.id ?? eligible[0]?.id ?? "" },
    fields: [titleField, amountField, { key: "members", label: "Người đóng góp", multiple: true, options: memberOptions(members, self) }, { key: "destination", label: "Tài khoản nhận", options: eligible.map(row => ({ value: row.id, label: `${row.bank_code ?? "VietQR"} · ${row.account_number ?? row.id.slice(0, 8)}` })) }, { key: "note", label: "Ghi chú (không bắt buộc)", multiline: true }],
    build: values => {
      const selected = [...new Set((values.members ?? "").split(",").filter(Boolean))];
      if (!selected.length || selected.some(user => !members.some(member => member.user_id === user && !member.left_at))) throw new Error("Chọn ít nhất một thành viên đang tham gia.");
      if (!eligible.some(row => row.id === values.destination)) throw new Error("Cần tài khoản nhận đang hoạt động và đã xác nhận.");
      return commands.contributionRequest(fund, { title: text(values.title ?? "", "Nội dung", 200), contributions: selected.map(member_user_id => ({ member_user_id, amount: parseMoney(values.amount ?? ""), destination_id: values.destination })), ...(values.note?.trim() ? { note: text(values.note, "Ghi chú") } : {}) });
    } };
}
export function contributionForm(fund: Fund, row: Contribution, action: Parameters<typeof commands.contribution>[2]): FinanceFormSpec {
  const reason = ["waive", "cancel", "reject-transfer", "reverse"].includes(action);
  return { title: actionLabels[action], description: `${money(row.amount)} · Thành viên ${row.member_user_id.slice(0, 8)}. ${reason ? reasonDescription : action === "confirm-received" ? "Chỉ xác nhận sau khi đối chiếu đã nhận đủ tiền; xác nhận sẽ ghi thu vào sổ quỹ." : action === "report-transfer" ? "Báo đã chuyển chưa làm tăng số dư. Chờ người giữ quỹ xác nhận nhận đủ." : "Chỉ sửa khoản còn chờ; không thay đổi tài khoản nhận đã chốt."}`,
    initial: { amount: row.amount }, fields: action === "amount" ? [amountField] : reason ? [reasonField] : [], destructive: reason,
    receipt: action === "report-transfer" ? { fundId: fund.id, field: "evidence_object_key" } : undefined,
    build: values => commands.contribution(fund, row, action, action === "amount" ? { amount: parseMoney(values.amount ?? "") } : reason ? { reason: text(values.reason ?? "", "Lý do") } : {}) };
}
export function expenseForm(fund: Fund, row?: Expense): FinanceFormSpec {
  return { title: row ? "Sửa khoản chi" : "Tạo khoản chi", description: "Lưu nháp trên máy chủ. Sau đó gửi duyệt; chỉ khi người giữ quỹ xác nhận đã chi mới ghi giảm số dư.",
    initial: { title: row?.title ?? "", amount: row?.amount ?? "", category: row?.category ?? "", description: row?.description ?? "" },
    fields: [titleField, amountField, { key: "category", label: "Danh mục (không bắt buộc)", max: 80 }, { key: "description", label: "Mô tả (không bắt buộc)", multiline: true, max: 10000 }], receipt: { fundId: fund.id, field: "receipt_object_key" },
    build: values => commands.expense(fund, { title: text(values.title ?? "", "Nội dung", 200), amount: parseMoney(values.amount ?? ""), category: values.category?.trim() ? text(values.category, "Danh mục", 80) : null, description: values.description?.trim() ? text(values.description, "Mô tả", 10000) : null }, row) };
}
export function expenseActionForm(fund: Fund, row: Expense, action: Parameters<typeof commands.expenseAction>[2], timezone: string): FinanceFormSpec {
  const reason = action === "reject" || action === "reverse";
  const paidAt = row.paid_at ?? new Date().toISOString();
  return { title: actionLabels[action], description: `${row.title} · ${money(row.amount)}. ${reason ? reasonDescription : action === "confirm" ? "Đối chiếu tiền thực tế. Máy chủ kiểm số dư khả dụng sau phần giữ chỗ hoàn tiền trước khi ghi chi." : "Cập nhật trạng thái đề nghị chi trên máy chủ."}`, destructive: reason || action === "delete",
    initial: { date: dateLabel(paidAt, timezone), time: timeLabel(paidAt, timezone), payment_method: row.payment_method ?? "BANK_TRANSFER" },
    fields: reason ? [reasonField] : action === "confirm" ? [{ key: "date", label: "Ngày đã chi", mode: "date" }, { key: "time", label: `Giờ đã chi (${timezone})`, mode: "time" }, { key: "payment_method", label: "Hình thức chi", options: [{ value: "BANK_TRANSFER", label: "Chuyển khoản" }, { value: "CASH", label: "Tiền mặt" }, { value: "OTHER", label: "Khác" }] }] : [],
    build: values => {
      const date = parseDate(values.date ?? "");
      const paid_at = date ? localTimestamp(date, values.time ?? "", timezone) : undefined;
      if (action === "confirm" && !paid_at) throw new Error("Ngày/giờ đã chi không hợp lệ trong múi giờ chuyến đi.");
      return commands.expenseAction(fund, row, action, reason ? { reason: text(values.reason ?? "", "Lý do") } : action === "confirm" ? { paid_at, payment_method: text(values.payment_method ?? "", "Hình thức chi", 30) } : {});
    } };
}
export function refundForm(fund: Fund, members: Membership[], self: string): FinanceFormSpec {
  return { title: "Tạo hoàn tiền", description: "Khoản hoàn sẽ giữ chỗ từ số dư khả dụng. Tiền chỉ được ghi chi khi người nhận xác nhận đã nhận; app không chuyển tiền hộ.", fields: [{ key: "member", label: "Người nhận hoàn", options: memberOptions(members, self) }, amountField, reasonField],
    build: values => { if (!members.some(row => row.user_id === values.member && !row.left_at)) throw new Error("Chọn người nhận đang tham gia."); return commands.refund(fund, { member_user_id: values.member, amount: parseMoney(values.amount ?? ""), reason: text(values.reason ?? "", "Lý do") }); } };
}
export function refundActionForm(fund: Fund, row: Refund, action: Parameters<typeof commands.refundAction>[2]): FinanceFormSpec {
  const reason = ["confirm-nonreceipt", "cancel", "request-reversal", "reverse"].includes(action);
  return { title: actionLabels[action], description: `${money(row.amount)} · Người nhận ${row.member_user_id.slice(0, 8)}. ${action === "reverse" ? "Phải nhập đúng lý do của yêu cầu đảo đã được người nhận đồng ý. Backend không trả lý do đảo trong danh sách; đối chiếu trực tiếp với người giữ quỹ." : action === "consent-reversal" ? "Chỉ đồng ý sau khi đã trao đổi lý do với người giữ quỹ. Đây là đồng ý đảo sổ, không phải tự thu hồi tiền ngân hàng." : "Người giữ quỹ báo trả; chính người nhận xác nhận đã nhận đủ. Hủy khoản đã báo trả cần người nhận báo chưa nhận trước."}`,
    fields: reason ? [reasonField] : [], destructive: ["cancel", "reverse", "request-reversal"].includes(action),
    build: values => commands.refundAction(fund, row, action, reason ? text(values.reason ?? "", "Lý do") : undefined) };
}
export function closureForm(fund: Fund): FinanceFormSpec {
  return { title: "Yêu cầu đóng quỹ", description: "Cần số dư bằng 0, không còn khoản góp/chi/hoàn tiền hay thanh toán chưa xử lý. Quỹ chuyển sang đang đóng và khóa thay đổi; mọi người trong bản chốt phải xác nhận. Không tự đóng theo thời gian.", build: () => commands.closure(fund) };
}
export function closureActionForm(row: Closure, action: "confirm" | "cancel" | "remind"): FinanceFormSpec {
  return { title: action === "confirm" ? "Xác nhận bản chốt quỹ" : action === "cancel" ? "Hủy phiên đóng quỹ" : "Nhắc xác nhận đóng quỹ", description: action === "confirm" ? `Bạn xác nhận đúng bản chốt đã xem, mã ${row.snapshot_hash}. Người xác nhận cuối sẽ đóng quỹ vĩnh viễn.` : action === "cancel" ? "Hủy phiên hiện tại và mở lại quỹ. Phiên đóng mới cần mọi người xác nhận lại." : "Ghi yêu cầu nhắc vào backend; phản hồi chấp nhận không chứng minh thông báo đã được gửi.", fields: action === "cancel" ? [reasonField] : [], destructive: action === "cancel", build: values => commands.closureAction(row, action, action === "cancel" ? text(values.reason ?? "", "Lý do") : undefined) };
}
