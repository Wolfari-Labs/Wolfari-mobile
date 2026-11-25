import { ApiError } from "./api-client.ts";

export function errorMessage(error: unknown, fallback = "Chưa thể hoàn tất. Vui lòng thử lại."): string {
  if (error instanceof ApiError) {
    if (error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') return 'Máy chủ chưa cấu hình MoMo Test. Cần bộ khóa sandbox và địa chỉ nhận kết quả thanh toán.';
    if (error.reason === "PROVIDER_QUERY_UNSUPPORTED") return "Nguồn giá vé thật chỉ theo dõi vé một chiều, hạng phổ thông, 1 người lớn. Hãy chỉnh lại chuyến bay.";
    if (error.reason === "PRICE_PROVIDER_NOT_CONFIGURED") return "Máy chủ chưa cấu hình nguồn giá vé thật. Người quản trị cần thêm khóa Travelpayouts rồi thử lại.";
    if (error.code === "NETWORK_ERROR") return "Không thể kết nối. Kiểm tra mạng rồi thử lại.";
    if (error.code === "SESSION_CHANGED") return "Phiên đăng nhập vừa thay đổi (app được tải lại hoặc đổi tài khoản). Đợi app đăng nhập xong rồi thử lại.";
    if (error.code === "INVALID_RESPONSE") return "Máy chủ trả phản hồi không đúng định dạng. Kiểm tra trạng thái để biết yêu cầu đã được ghi nhận chưa.";
    if (error.code === "REQUEST_TIMEOUT") return "Chưa nhận được phản hồi. Vui lòng kiểm tra lại trạng thái yêu cầu.";
    if (error.code === "VERSION_CONFLICT") return "Dữ liệu vừa được cập nhật. Tải lại thông tin và kiểm tra trước khi gửi yêu cầu mới.";
    if (error.code === "FINANCE_OBLIGATION_BLOCKED") return "Chưa thể rời hoặc xóa thành viên vì còn nghĩa vụ tài chính cần giải quyết.";
    if (error.reason === "INSUFFICIENT_AVAILABLE_BALANCE") return "Quỹ không đủ số dư khả dụng cho khoản chi này. Cần thêm tiền vào quỹ (đóng góp được xác nhận) rồi xác nhận lại.";
    if (error.code === "STATE_CONFLICT") return "Trạng thái hiện tại chưa cho phép thao tác. Kiểm tra các giao dịch và yêu cầu đang chờ trước khi thử lại.";
    if (error.status === 409) return "Dữ liệu hoặc trạng thái vừa thay đổi. Tải lại rồi kiểm tra trước khi thử lại.";
    if (error.status === 403) return "Bạn chưa có quyền thực hiện thao tác này trong chuyến đi.";
    if (error.status === 404) return "Nội dung không còn khả dụng hoặc bạn không còn là thành viên.";
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status >= 500) return "Dịch vụ đang tạm gián đoạn. Bạn có thể thử lại sau.";
    if (error.status === 429) return "Bạn thao tác hơi nhanh. Vui lòng chờ một chút rồi thử lại.";
    if (error.status === 400) return "Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường đã nhập.";
    // Name the status so an unexpected answer can be traced instead of reading as a generic failure.
    if (error.status > 0) return `Máy chủ không chấp nhận yêu cầu (mã ${error.status}). Thử lại sau ít phút.`;
    return fallback;
  }
  // Preserve local Vietnamese validation, while native/transport diagnostics stay internal.
  if (error instanceof Error) {
    const message = error.message.trim();
    const technical = /[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}|\b[\da-f]{24,}\b|\b[A-Z][A-Z\d]*(?:_[A-Z\d]+)+\b|https?:\/\/|\b(?:Error|Exception|TypeError|SyntaxError|NUL)\b/i;
    if (/[À-ỹĐđ]/u.test(message) && !technical.test(message) && message.length <= 1000)
      return message;
  }
  return fallback;
}
