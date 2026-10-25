import { isRecord } from "./local-parity.ts";
export type LocalPlace = {
  id: string; name: string; address: string; latitude: number | null; longitude: number | null;
  source: string; attribution: { text: string; url: string }[];
};
export type PlaceDraft = { selected: string[]; hidden: string[]; places: LocalPlace[] };
export const emptyPlaceDraft: PlaceDraft = { selected: [], hidden: [], places: [] };
export function validCoordinates(latitude: number | null, longitude: number | null) {
  return latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
export function isPlaceDraft(value: unknown): value is PlaceDraft {
  if (!isRecord(value)) return false;
  const ids = (v: unknown) => Array.isArray(v) && v.length <= 500 && v.every(id => typeof id === "string" && id.length <= 500);
  return ids(value.selected) && ids(value.hidden) && Array.isArray(value.places) && value.places.length <= 500 && value.places.every(p =>
    isRecord(p) && ["id", "name", "address", "source"].every(key => typeof p[key] === "string" && (p[key] as string).length <= 2000) &&
    ((p.latitude === null && p.longitude === null) || (typeof p.latitude === "number" && typeof p.longitude === "number" && validCoordinates(p.latitude, p.longitude))) &&
    Array.isArray(p.attribution) && p.attribution.length <= 30 && p.attribution.every(a => isRecord(a) && typeof a.text === "string" && typeof a.url === "string")
  );
}
