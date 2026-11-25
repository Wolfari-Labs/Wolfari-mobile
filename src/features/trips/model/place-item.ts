import { getApiBaseUrl } from "@/shared/config/env";
import type { useApi } from "@/shared/api/use-api";
import type { PoiPlace, SelectedLocation } from "../types";
import { POI_GROUPS, poiImageUrl, prettyAttribution, validCoordinates, type LatLng } from "./place";

/** One place as shown in lists: a search result, a saved group place or a route stop. */
export type PlaceItem = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  /** Server-issued token for saving a search result exactly as found. */
  token?: string;
  icon?: string;
  categoryLabel?: string;
  durationMin?: number;
  activityType?: string;
  dressHint?: string;
  verified?: boolean;
  /** Licensed photo (absolute URL) and its mandatory credit line. */
  photo?: { uri: string; fullUri?: string; attribution: string; sourceUrl: string };
  /** Where the data comes from; the list shows it once, not on every card. */
  source: string;
  attribution: { text: string; url: string }[];
};

const groupIcon = (category?: string) => POI_GROUPS.find((group) => group.value === category)?.icon;
export function fromPoi(place: PoiPlace): PlaceItem {
  const image = place.hero_image;
  const uri = image ? poiImageUrl(image.thumbnail_url, getApiBaseUrl()) : undefined;
  return {
    ...(uri && image?.attribution && image.source_url ? { photo: { uri, fullUri: poiImageUrl(image.url, getApiBaseUrl()), attribution: image.attribution, sourceUrl: image.source_url } } : {}),
    id: "poi:" + place.id,
    name: place.name,
    address: place.address ?? place.province_name ?? "",
    latitude: place.coordinates.latitude,
    longitude: place.coordinates.longitude,
    token: place.selection_token,
    icon: groupIcon(place.category_group ?? undefined) ?? "📍",
    categoryLabel: place.category_label || undefined,
    durationMin: place.typical_duration_min,
    activityType: place.activity_type,
    dressHint: place.dress_code_hint || undefined,
    verified: place.coord_verified,
    source: prettyAttribution(place.attribution || "OpenStreetMap"),
    attribution: [],
  };
}

export function fromSaved(location: SelectedLocation): PlaceItem {
  return {
    id: location.id,
    name: location.name,
    address: location.address ?? "",
    latitude: location.latitude === null ? null : Number(location.latitude),
    longitude: location.longitude === null ? null : Number(location.longitude),
    source: "Kế hoạch chung",
    attribution: location.metadata?.attribution ?? [],
  };
}

const near = (a: number | null, b: number | null) => (a === null ? b === null : b !== null && Math.abs(a - b) < 0.0001);
export const coordsOf = (place: PlaceItem): LatLng | undefined => (validCoordinates(place.latitude, place.longitude) ? { latitude: place.latitude!, longitude: place.longitude! } : undefined);


export function matchingLocation(locations: SelectedLocation[], place: PlaceItem) {
  return locations.find(p => p.id === place.id || (p.name === place.name && near(p.latitude === null ? null : Number(p.latitude), place.latitude) && near(p.longitude === null ? null : Number(p.longitude), place.longitude)));
}

export function storeLocation(api: ReturnType<typeof useApi>["trips"], tripId: string, place: PlaceItem, version: number, key: string) {
  if (place.token) return api.saveLocationToken(tripId, { selection_token: place.token, expected_plan_version: version }, key);
  return api.saveLocation(tripId, {
    name: place.name.trim(), address: place.address.trim() || null,
    latitude: place.latitude?.toFixed(6) ?? null, longitude: place.longitude?.toFixed(6) ?? null,
    attribution: place.attribution.filter(a => a.url.startsWith("https://")), expected_plan_version: version,
  }, key);
}
