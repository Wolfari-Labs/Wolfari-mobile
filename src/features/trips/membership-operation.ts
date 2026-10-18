import type { MembershipOperation, Trip } from "./types";

export type MembershipRequest = { key: string; trip: Trip; memberId?: string; reason: string; operation?: MembershipOperation };
// Preserve uncertain requests when navigating away/back. Never persist reason text or tokens.
export const pendingMembershipRequests = new Map<string, MembershipRequest>();

export function membershipCommitted(operation?: MembershipOperation) {
  return operation?.state === "SUCCEEDED" && operation.outcome?.status === "COMMITTED";
}
export function membershipPending(operation?: MembershipOperation) {
  return !operation || operation.state === "PROCESSING" || operation.state === "PENDING_RECOVERY";
}
export function membershipMessage(operation?: MembershipOperation): string {
  if (!operation) return "Chưa xác định được kết quả. Kiểm tra trạng thái hoặc gửi lại đúng yêu cầu cũ; không tạo yêu cầu khác.";
  if (membershipCommitted(operation)) return "Thao tác đã hoàn tất trên máy chủ.";
  if ((operation.error_code ?? operation.outcome?.error_code) === "FINANCE_OBLIGATION_BLOCKED") return "Không thể hoàn tất vì thành viên còn nghĩa vụ tài chính cần giải quyết.";
  if (operation.state === "NEEDS_REVIEW") return "Yêu cầu cần bộ phận vận hành kiểm tra. Giữ mã yêu cầu bên dưới và không gửi yêu cầu mới.";
  if (operation.state === "FAILED") return "Yêu cầu không thành công. Tải lại thông tin nhóm trước khi thực hiện thao tác khác.";
  if (membershipPending(operation)) return "Máy chủ đang xử lý. Thành viên chưa được xác nhận là đã rời nhóm. App sẽ kiểm tra lại khi màn hình đang mở.";
  return "Chưa có xác nhận hoàn tất hợp lệ. Hãy liên hệ hỗ trợ với mã yêu cầu bên dưới.";
}
