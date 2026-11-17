const reviewReasons: Record<string, string> = {
  INVALID_SIGNATURE: "Chưa xác minh được thông báo thanh toán",
  ATTEMPT_NOT_FOUND: "Chưa tìm thấy lần thanh toán tương ứng",
  MERCHANT_MISMATCH: "Thông tin bên nhận chưa khớp",
  REQUEST_MISMATCH: "Thông tin yêu cầu thanh toán chưa khớp",
  AMOUNT_MISMATCH: "Số tiền thanh toán chưa khớp",
  ORDER_INFO_MISMATCH: "Nội dung thanh toán chưa khớp",
  AUTHORIZED_OR_PENDING: "Thanh toán đang chờ kết quả cuối cùng",
  LATE_OR_CONFLICTING_SUCCESS: "Kết quả thanh toán đến muộn hoặc cần đối chiếu lại",
  NO_FINANCIAL_EFFECT: "Đã đối chiếu: không thay đổi số dư quỹ",
  LINKED: "Đã liên kết với lần thanh toán tương ứng",
};

export function paymentReviewReason(reason: string | null) {
  return reason ? reviewReasons[reason] ?? "Cần đối chiếu lại thông tin thanh toán" : "Chưa có lý do";
}
