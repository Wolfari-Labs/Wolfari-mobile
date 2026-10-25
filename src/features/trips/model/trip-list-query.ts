import type { Lifecycle, Trip } from "../types";
import { normalizeText } from "./local-parity.ts";

export type TripFilter = Lifecycle | "ALL";
export type TripSort = "default" | "asc" | "desc";
export function queryTrips(trips: Trip[], filter: TripFilter, query: string, sort: TripSort) {
  const text = normalizeText(query);
  const result = trips.filter(trip => (filter === "ALL" || trip.lifecycle === filter) && normalizeText(trip.name).includes(text));
  if (sort !== "default") result.sort((a, b) => (Date.parse(a.start_at) - Date.parse(b.start_at)) * (sort === "asc" ? 1 : -1) || a.id.localeCompare(b.id));
  return result;
}
