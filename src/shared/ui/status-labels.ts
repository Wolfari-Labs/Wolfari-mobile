const labels: Record<string, string> = {
  TODO: "Chưa hoàn thành", COMPLETED: "Đã hoàn thành", ACTIVE: "Đang hoạt động",
  OPEN: "Đang mở", CLOSING: "Đang chốt", CLOSED: "Đã đóng",
  PENDING: "Đang chờ", PROCESSING: "Đang xử lý", PENDING_RECOVERY: "Đang kiểm tra lại",
  NEEDS_REVIEW: "Cần kiểm tra", SUCCEEDED: "Đã xử lý", FAILED: "Chưa hoàn tất",
  CONFIRMED: "Đã xác nhận", TRANSFER_REPORTED: "Đã báo chuyển",
  SUBMITTED: "Chờ duyệt", HOLDER_REPORTED: "Đã báo hoàn",
  PENDING_CONFIRMATIONS: "Chờ thành viên xác nhận", PAUSED: "Tạm dừng",
  REJECTED: "Đã từ chối", CANCELLED: "Đã hủy", REVERSED: "Đã đảo giao dịch",
  STOPPED: "Đã dừng", EXPIRED: "Đã hết hạn", DRAFT: "Bản nháp", WAIVED: "Được miễn",
  CREATED: "Đã tạo", PENDING_PROVIDER: "Chờ xác nhận thanh toán", RECEIVED: "Đã tiếp nhận",
  PROCESSED: "Đã xử lý", IGNORED: "Không áp dụng", SENT: "Đã gửi",
};

export function statusText(status: string) {
  return labels[status] ?? "Chưa có thông tin trạng thái";
}
