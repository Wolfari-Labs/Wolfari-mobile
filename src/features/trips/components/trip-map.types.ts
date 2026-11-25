import type { LatLng, MapRegion } from "../model/place";

/** saved: the group's place · result: a search result · stop: a numbered stop on a day route. */
export type MapPoint = LatLng & { id: string; name: string; tone?: "saved" | "result" | "stop"; label?: string };
export type MapRoute = { geometry: LatLng[]; estimated: boolean };
export type TripMapProps = {
  points: MapPoint[];
  selectedId?: string;
  onSelect: (id: string) => void;
  route?: MapRoute;
  mapType?: "standard" | "satellite" | "paper";
  /** Called after the user pans or zooms (not after the map fits itself). */
  onUserMove?: (region: MapRegion) => void;
  /** Change it to make the map frame the current points again. */
  fitKey?: string;
  height?: number;
};

export const MAP_TONES = {
  saved: { fill: "#245CB8", text: "#FFFFFF" },
  result: { fill: "#FFFFFF", text: "#1F2A44" },
  start: { fill: "#AF6500", text: "#FFFFFF" },
  stop: { fill: "#158278", text: "#FFFFFF" },
} as const;
