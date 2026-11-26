/**
 * FR-TI01 / FR-DS01 / FR-DS03 view helpers. The server decides what to suggest and why;
 * these only pick the point to ask the weather for, and turn codes into short Vietnamese text.
 */
import type { Activity, Plan, Recommendation, RecommendationItem, RecommendationSource, WeatherDay, WeatherMeta } from "../types";
import { activityDay, calendarLabel, timeLabel } from "../utils.ts";

type Point = { latitude: number; longitude: number };

const coordinate = (latitude: string | null, longitude: string | null): Point | undefined => {
  const lat = Number(latitude), lng = Number(longitude);
  return latitude !== null && longitude !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { latitude: lat, longitude: lng }
    : undefined;
};

/** The day's first located stop, else the trip's first saved place, else nothing to ask about. */
export function dayPoint(plan: Pick<Plan, "activities" | "selected_locations">, day: string, timezone: string): Point | undefined {
  const places = new Map(plan.selected_locations.map((place) => [place.id, coordinate(place.latitude, place.longitude)]));
  const stops = [...plan.activities]
    .filter((activity) => activityDay(activity, timezone) === day && activity.selected_location_id)
    .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "") || a.position - b.position);
  for (const stop of stops) {
    const point = places.get(stop.selected_location_id!);
    if (point) return point;
  }
  for (const point of places.values()) if (point) return point;
  return undefined;
}

const round = (value: number) => Math.round(value);

/** "31° / 24° · Mưa 60% · UV 8 cao" — parts the provider did not send are left out. */
export function weatherSummary(day: WeatherDay) {
  const parts: string[] = [];
  if (day.temperature_max_c !== null)
    parts.push(day.temperature_min_c !== null ? `${round(day.temperature_max_c)}° / ${round(day.temperature_min_c)}°` : `${round(day.temperature_max_c)}°`);
  if (day.rain_probability !== null) parts.push(`Mưa ${round(day.rain_probability * 100)}%`);
  if (day.uv_index !== null) parts.push(`UV ${round(day.uv_index)}${day.uv_index >= 8 ? " rất cao" : day.uv_index >= 6 ? " cao" : ""}`);
  return parts.join(" · ");
}

/** The one-word mood for the day's icon and colour. */
export function weatherMood(day: WeatherDay): "rain" | "sun" | "cool" | "mild" {
  if ((day.rain_probability ?? 0) >= 0.5) return "rain";
  if ((day.temperature_min_c ?? 99) <= 18) return "cool";
  if ((day.uv_index ?? 0) >= 6 || (day.temperature_max_c ?? 0) >= 32) return "sun";
  return "mild";
}

/** Provider line under weather or suggestions: who, when, and whether it is old or sample data. */
export function sourceLine(source: Pick<WeatherMeta | RecommendationSource, "provider" | "fetched_at" | "stale" | "is_mock">, timezone: string) {
  const name = source.is_mock ? "Dữ liệu mẫu" : source.provider === "OPEN_METEO" ? "Open-Meteo" : source.provider;
  const when = source.fetched_at ? ` · cập nhật ${timeLabel(source.fetched_at, timezone)}` : "";
  return `${name}${when}${source.stale ? " · có thể đã cũ" : ""}`;
}

const warningText: Record<string, string> = {
  ALREADY_IN_PLAN: "Đã có trong danh sách",
  ACTIVITY_REMOVED: "Hoạt động đã bị xóa",
  WEATHER_UNAVAILABLE: "Chưa lấy được thời tiết cho một số ngày, gợi ý chỉ dựa trên lịch trình.",
  FORECAST_OUT_OF_RANGE: "Có ngày còn xa hơn 16 ngày nên chưa có dự báo. Quay lại gần ngày đi để có gợi ý theo thời tiết.",
};
export const warningLabel = (code: string) => warningText[code];

/** Rows that would only duplicate what the group already has start unticked. */
export function initialSelection(recommendation: Recommendation) {
  return new Set(recommendation.items.filter((item) => !item.warnings.includes("ALREADY_IN_PLAN")).map((item) => item.id));
}

export function itemTitle(item: RecommendationItem) {
  if (item.packing_item) {
    const { name, quantity, unit } = item.packing_item;
    return quantity && quantity !== "1" ? `${name} · ${quantity}${unit ? ` ${unit}` : ""}` : name;
  }
  return item.dress_code?.label ?? "";
}

/** "Chùa Linh Ứng · 12/11" for a dress code; packing rows have no context line. */
export function itemContext(item: RecommendationItem, activities: Pick<Activity, "id" | "title">[]) {
  if (!item.dress_code) return item.packing_item?.category;
  const activity = activities.find((entry) => entry.id === item.dress_code!.activity_id)?.title;
  return [activity, item.date ? calendarLabel(item.date).slice(0, 5) : undefined].filter(Boolean).join(" · ") || undefined;
}

/** "Đã thêm 3 gợi ý" plus how many were skipped, for the toast after apply. */
export function appliedMessage(recommendation: Recommendation) {
  const created = recommendation.applied?.created.length ?? 0, skipped = recommendation.applied?.skipped.length ?? 0;
  if (!created) return skipped ? "Các gợi ý đã chọn đều có sẵn trong chuyến đi." : "Chưa có gợi ý nào được thêm.";
  return `Đã thêm ${created} gợi ý vào chuyến đi${skipped ? `, bỏ qua ${skipped} mục đã có` : ""}.`;
}
