/** A place card: a shared trip location or a search result. */
export type PlaceView = {
  id: string; name: string; address: string; latitude: number | null; longitude: number | null;
  source: string; attribution: { text: string; url: string }[];
};
export function validCoordinates(latitude: number | null, longitude: number | null) {
  return latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
