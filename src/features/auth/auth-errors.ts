import { ApiError } from "@/shared/api/api-client";

export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "UNAUTHENTICATED") return "Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.";
    if (error.code === "RESOURCE_EXHAUSTED" || error.status === 429) return "Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.";
    if (error.code === "VALIDATION_FAILED") return "Vui lòng kiểm tra thông tin bạn đã nhập.";
    if (error.code === "NETWORK_ERROR" || error.code === "REQUEST_TIMEOUT") return error.message;
    if (error.code === "SERVICE_UNAVAILABLE" || error.status >= 500) return "Hệ thống đang bận. Vui lòng thử lại sau ít phút.";
  }
  return "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
}
