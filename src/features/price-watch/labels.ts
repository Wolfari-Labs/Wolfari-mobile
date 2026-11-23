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
    TRAVELPAYOUTS_CACHE: "Aviasales · giá tham khảo",
    AMADEUS: "Amadeus", DUFFEL: "Duffel", SKYSCANNER: "Skyscanner",
  };
  return providers[provider.toUpperCase()] ?? "Nhà cung cấp giá";
}

/** Real (cached fares from real searches) vs simulated, from the source code the server reports. */
export function priceKind(provider: string | undefined): "real" | "mock" | "unknown" {
  const value = (provider ?? "").toUpperCase();
  if (value === "MOCK" || value === "MOCK_FLIGHT") return "mock";
  return value ? "real" : "unknown";
}

/** "Giá thật" / "Giá mô phỏng" for headings. */
export function priceKindLabel(provider: string | undefined) {
  const kind = priceKind(provider);
  return kind === "real" ? "Giá vé thật" : kind === "mock" ? "Giá mô phỏng" : "Giá";
}

/** How fresh a cached real fare is (fare_metadata.source_freshness / provider_found_at). */
export function freshnessLabel(metadata: Record<string, string | null> | null | undefined, now = Date.now()) {
  if (!metadata) return "";
  const found = metadata.provider_found_at ? Date.parse(metadata.provider_found_at) : NaN;
  const hours = Number.isFinite(found) ? Math.max(0, Math.round((now - found) / 3_600_000)) : undefined;
  const age = hours === undefined ? "" : hours < 1 ? "tìm thấy dưới 1 giờ trước" : hours < 48 ? `tìm thấy ${hours} giờ trước` : `tìm thấy ${Math.round(hours / 24)} ngày trước`;
  if (metadata.source_freshness === "FRESH_REFERENCE") return age ? `Mới · ${age}` : "Mới";
  if (metadata.source_freshness === "STALE") return age ? `Đã cũ · ${age}` : "Đã cũ";
  return age;
}
