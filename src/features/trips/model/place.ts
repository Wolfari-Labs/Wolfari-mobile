/** A place card: a shared trip location or a search result. */
export type PlaceView = {
  id: string; name: string; address: string; latitude: number | null; longitude: number | null;
  source: string; attribution: { text: string; url: string }[];
};
export function validCoordinates(latitude: number | null, longitude: number | null) {
  return latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export type LatLng = { latitude: number; longitude: number };
export type MapRegion = LatLng & { latitudeDelta: number; longitudeDelta: number };

/** Search groups offered as chips; values are the server's `category` filter. */
export const POI_GROUPS = [
  { value: "tourism", label: "Tham quan", icon: "🏛️" },
  { value: "restaurant", label: "Ăn uống", icon: "🍜" },
  { value: "cafe", label: "Cà phê", icon: "☕" },
  { value: "accommodation", label: "Lưu trú", icon: "🏨" },
  { value: "shopping", label: "Mua sắm", icon: "🛍️" },
  { value: "entertainment", label: "Vui chơi", icon: "🎡" },
  { value: "nightlife", label: "Về đêm", icon: "🌙" },
  { value: "all", label: "Tất cả", icon: "✨" },
] as const;

/** The server's default search centre (Đà Nẵng), used until the group saves a place. */
export const DEFAULT_CENTER: LatLng = { latitude: 16.0544, longitude: 108.2022 };

/** "~45 phút", "~1 giờ 30 phút", "~2 giờ". */
export function durationLabel(minutes: number | undefined | null) {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return "";
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60), rest = rounded % 60;
  return "~" + (hours ? `${hours} giờ${rest ? ` ${rest} phút` : ""}` : `${rest} phút`);
}

export function distanceLabel(meters: number) {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toLocaleString("vi-VN", { maximumFractionDigits: meters < 10_000 ? 1 : 0 })} km`;
}

/** Map a POI's suggested activity type onto the activity form's choices. */
export function formActivityType(poiType: string | undefined) {
  const value = (poiType ?? "").toUpperCase();
  if (["FOOD", "MEAL", "RESTAURANT", "CAFE", "DRINK"].includes(value)) return "MEAL";
  if (value === "TRANSPORT") return "TRANSPORT";
  return "SIGHTSEEING";
}

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180, earth = 6_371_000;
  const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Straight segments between stops: shown dashed when no road route is available. */
export function straightLine(stops: LatLng[]) {
  let distance = 0;
  for (let index = 1; index < stops.length; index++) distance += haversine(stops[index - 1], stops[index]);
  return { distance_m: distance, geometry: stops };
}

/** The visible map frame as the server's bbox ("minLon,minLat,maxLon,maxLat"), at most 2° per side. */
export function regionBbox(region: MapRegion) {
  const lat = Math.min(Math.abs(region.latitudeDelta), 2) / 2, lon = Math.min(Math.abs(region.longitudeDelta), 2) / 2;
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
  const box = [
    clamp(region.longitude - lon, 180), clamp(region.latitude - lat, 90),
    clamp(region.longitude + lon, 180), clamp(region.latitude + lat, 90),
  ];
  return box.map((value) => value.toFixed(5)).join(",");
}

/** A frame that shows every point with some margin (or the default centre). */
export function fitRegion(points: LatLng[]): MapRegion {
  if (!points.length) return { ...DEFAULT_CENTER, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  const lats = points.map((p) => p.latitude), lons = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.02, (maxLon - minLon) * 1.4),
  };
}

/** Centre of the group's saved places, so "nearby" means near the trip. */
export function centerOf(points: LatLng[]): LatLng | undefined {
  if (!points.length) return undefined;
  return {
    latitude: points.reduce((sum, p) => sum + p.latitude, 0) / points.length,
    longitude: points.reduce((sum, p) => sum + p.longitude, 0) / points.length,
  };
}

const POI_IMAGE_PATH = /^\/api\/v1\/travel\/poi-images\/[0-9a-f]{64}\/(320|640|1280)\.webp$/;
/**
 * Absolute URL of a POI photo served by our Gateway. Only that exact route is accepted, so a
 * response can never make the app load an arbitrary third-party URL.
 */
export function poiImageUrl(path: string | null | undefined, apiBase: string) {
  if (!path || !POI_IMAGE_PATH.test(path)) return undefined;
  try {
    return new URL(path, apiBase).href;
  } catch {
    return undefined;
  }
}
