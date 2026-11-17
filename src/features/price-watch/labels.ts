const reasons: Record<string, string> = {
  USER_STOPPED: "Bạn đã dừng theo dõi",
  DEPARTED: "Đã qua giờ khởi hành",
  TRIP_ARCHIVED: "Chuyến đi đã được lưu trữ",
  TRIP_DELETED: "Chuyến đi đã được xóa",
  ACCESS_REVOKED: "Bạn không còn quyền truy cập chuyến đi",
  MEMBER_LEFT: "Bạn đã rời chuyến đi",
  MEMBER_REMOVED: "Bạn không còn là thành viên chuyến đi",
  ACCOUNT_SUSPENDED: "Tài khoản hiện bị tạm khóa",
  ACCOUNT_DELETED: "Tài khoản không còn hoạt động",
};

export function watchStatusReason(reason: string) {
  return reasons[reason] ?? "Theo dõi đã thay đổi trạng thái. Tải lại để kiểm tra.";
}

export function priceProviderLabel(provider: string) {
  const providers: Record<string, string> = {
    MOCK: "Nguồn mô phỏng", MOCK_FLIGHT: "Nguồn mô phỏng",
    AMADEUS: "Amadeus", DUFFEL: "Duffel", SKYSCANNER: "Skyscanner",
  };
  return providers[provider.toUpperCase()] ?? "Nhà cung cấp giá";
}
