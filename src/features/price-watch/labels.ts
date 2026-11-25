const reasons: Record<string, string> = {
  USER_STOPPED: "Đã dừng theo yêu cầu",
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

const providers = new Map([
  ["MOCK", "Nguồn mô phỏng"], ["MOCK_FLIGHT", "Nguồn mô phỏng"],
  ["SEARCHAPI_GOOGLE_FLIGHTS", "Google Flights (SearchApi)"],
  ["TRAVELPAYOUTS_CACHE", "Aviasales (Travelpayouts)"],
  ["AMADEUS", "Amadeus"], ["DUFFEL", "Duffel"], ["SKYSCANNER", "Skyscanner"],
]);

export function priceProviderLabel(provider: string) {
  return providers.get(provider.toUpperCase()) ?? "Nhà cung cấp giá";
}

export function priceKind(provider: string | undefined): "real" | "mock" | "unknown" {
  const value = (provider ?? "").toUpperCase();
  if (value === "MOCK" || value === "MOCK_FLIGHT") return "mock";
  return providers.has(value) ? "real" : "unknown";
}

export function priceKindLabel(provider: string | undefined) {
  const kind = priceKind(provider);
  return kind === "real" ? "Giá tham khảo" : kind === "mock" ? "Giá mô phỏng" : "Giá";
}

// Automation considers a reference fare current for up to 48 hours and until its source expiry.
export function fareFreshness(metadata: Record<string, string | null> | null | undefined, now = Date.now()) {
  if (metadata?.source_freshness !== "FRESH_REFERENCE") return metadata?.source_freshness;
  const found = Date.parse(metadata.provider_found_at ?? "");
  const expiry = metadata.provider_expires_at == null ? Infinity : Date.parse(metadata.provider_expires_at);
  if (!Number.isFinite(found) || found > now || Number.isNaN(expiry)) return "UNKNOWN";
  return now - found <= 48 * 3_600_000 && expiry > now ? "FRESH_REFERENCE" : "STALE";
}

export function freshnessLabel(metadata: Record<string, string | null> | null | undefined, now = Date.now()) {
  if (!metadata) return "";
  const found = metadata.provider_found_at ? Date.parse(metadata.provider_found_at) : NaN;
  const hours = Number.isFinite(found) ? Math.max(0, Math.round((now - found) / 3_600_000)) : undefined;
  const age = hours === undefined ? "" : hours < 1 ? "tìm thấy dưới 1 giờ trước" : hours < 48 ? `tìm thấy ${hours} giờ trước` : `tìm thấy ${Math.round(hours / 24)} ngày trước`;
  const freshness = fareFreshness(metadata, now);
  if (freshness === "FRESH_REFERENCE") return age ? `Mới · ${age}` : "Mới";
  if (freshness === "STALE") return age ? `Đã cũ · ${age}` : "Đã cũ";
  if (freshness === "UNKNOWN") return "Chưa xác định độ mới";
  return age;
}

const checkStatuses = new Map([
  ["PENDING", "Đang chờ kiểm tra giá"], ["RUNNING", "Đang kiểm tra giá"],
  ["SUCCEEDED", "Đã tìm thấy giá vé"], ["NO_RESULT", "Lần kiểm tra gần nhất chưa tìm thấy vé phù hợp"],
  ["FAILED", "Lần kiểm tra giá gần nhất thất bại"],
]);
export function checkStatusLabel(status?: string | null) {
  return status ? checkStatuses.get(status) : undefined;
}
