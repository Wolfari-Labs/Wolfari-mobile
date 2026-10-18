import { ApiError } from "./api-client";

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "Kế hoạch vừa được cập nhật. Tải lại dữ liệu rồi thử lại để giữ thay đổi của cả nhóm.";
    if (error.status === 403) return "Bạn chưa có quyền thực hiện thao tác này trong chuyến đi.";
    if (error.status === 404) return "Nội dung không còn khả dụng hoặc bạn không còn là thành viên.";
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 503) return "Dịch vụ đang tạm gián đoạn. Bạn có thể thử lại sau.";
    if (error.status === 429) return "Bạn thao tác hơi nhanh. Vui lòng chờ một chút rồi thử lại.";
    if (error.status === 400) return "Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường đã nhập.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Chưa thể hoàn tất. Vui lòng thử lại.";
}
