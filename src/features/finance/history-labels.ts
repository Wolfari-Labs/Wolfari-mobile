// Readable labels for Finance audit history (API162). Unknown future codes fall back to the raw code.
const actions: Record<string, string> = {
  ENABLE_FUND: "Mở quỹ",
  UPDATE_BUDGET: "Cập nhật ngân sách",
  CREATE_PAYMENT_DESTINATION: "Thêm tài khoản nhận",
  UPDATE_PAYMENT_DESTINATION: "Sửa tài khoản nhận",
  CONFIRM_PAYMENT_DESTINATION: "Người giữ quỹ xác nhận tài khoản nhận",
  CREATE_CONTRIBUTION_REQUEST: "Tạo đợt đóng góp",
  UPDATE_CONTRIBUTION_REQUEST: "Sửa đợt đóng góp",
  UPDATE_CONTRIBUTION_AMOUNT: "Sửa số tiền đóng góp",
  WAIVE_CONTRIBUTION: "Miễn đóng góp",
  CANCEL_CONTRIBUTION: "Hủy khoản đóng góp",
  REPORT_TRANSFER: "Báo đã chuyển tiền",
  REJECT_TRANSFER: "Từ chối báo chuyển",
  CONFIRM_RECEIVED: "Xác nhận đã nhận tiền",
  REVERSE_CONTRIBUTION: "Đảo khoản đóng góp",
  CREATE_PAYMENT_ATTEMPT: "Tạo lần thanh toán MoMo Sandbox",
  CONFIRM_PROVIDER_PAYMENT: "Nhà cung cấp xác nhận thanh toán",
  RECONCILE_PAYMENT_ATTEMPT: "Đối soát lần thanh toán",
  RESOLVE_PAYMENT_EXCEPTION: "Xử lý ngoại lệ thanh toán",
  MOMO_IPN: "Thông báo từ MoMo Sandbox",
  MOMO_RECONCILIATION: "Đối soát MoMo Sandbox",
  CREATE_EXPENSE: "Tạo khoản chi",
  UPDATE_EXPENSE: "Sửa khoản chi",
  DELETE_EXPENSE: "Xóa khoản chi nháp",
  SUBMIT_EXPENSE: "Gửi duyệt khoản chi",
  WITHDRAW_EXPENSE: "Rút đề nghị chi",
  CONFIRM_EXPENSE: "Xác nhận đã chi",
  REJECT_EXPENSE: "Từ chối khoản chi",
  REVERSE_EXPENSE: "Đảo khoản chi",
  CREATE_FINANCIAL_NOTE: "Thêm ghi chú ngoài quỹ",
  UPDATE_FINANCIAL_NOTE: "Sửa ghi chú ngoài quỹ",
  DELETE_FINANCIAL_NOTE: "Xóa ghi chú ngoài quỹ",
  CREATE_REFUND: "Tạo hoàn tiền",
  CANCEL_REFUND: "Hủy hoàn tiền",
  REPORT_REFUND_PAID: "Báo đã hoàn tiền",
  CONFIRM_REFUND_RECEIVED: "Xác nhận đã nhận hoàn tiền",
  CONFIRM_REFUND_NONRECEIPT: "Báo chưa nhận hoàn tiền",
  REQUEST_REFUND_REVERSAL: "Đề nghị đảo hoàn tiền",
  CONSENT_REFUND_REVERSAL: "Đồng ý đảo hoàn tiền",
  REVERSE_REFUND: "Đảo hoàn tiền",
  CREATE_CLOSURE: "Yêu cầu chốt quỹ",
  CONFIRM_CLOSURE: "Xác nhận bản chốt quỹ",
  CANCEL_CLOSURE: "Hủy phiên chốt quỹ",
  REMIND_CLOSURE: "Nhắc xác nhận chốt quỹ",
  LEAVE_MEMBER: "Thành viên rời nhóm",
  REMOVE_MEMBER: "Xóa thành viên khỏi nhóm",
};
const entities: Record<string, string> = {
  fund: "Quỹ", funds: "Quỹ", payment_destination: "Tài khoản nhận", contribution: "Đóng góp",
  contribution_request: "Đợt đóng góp", expense: "Khoản chi", refund: "Hoàn tiền", financial_note: "Ghi chú ngoài quỹ",
  closure: "Chốt quỹ", payment_attempt: "Thanh toán", payment_exception: "Đối soát", membership: "Thành viên",
};
const systems: Record<string, string> = { MOMO_IPN: "MoMo Sandbox", MOMO_RECONCILIATION: "Đối soát tự động" };

export function historyActionLabel(action: string) {
  return actions[action] ?? action;
}
export function historyEntityLabel(entity: string) {
  return entities[entity.toLowerCase()] ?? entity;
}
export function historyActorLabel(entry: { actor_user_id: string | null; system_actor?: string | null }, who: (userId: string) => string) {
  if (entry.actor_user_id) return who(entry.actor_user_id);
  return entry.system_actor ? systems[entry.system_actor] ?? entry.system_actor : "Hệ thống";
}
export function historyTimeLabel(iso: string, timezone = "Asia/Ho_Chi_Minh") {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).format(date);
}
