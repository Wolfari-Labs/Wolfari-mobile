import { router } from "expo-router";

import { Segments } from "@/shared/ui/journal";

export type TripSection = "overview" | "itinerary" | "places" | "tools";
const routes = { overview: "/trip/[id]", itinerary: "/trip/[id]/itinerary", places: "/trip/[id]/places", tools: "/trip/[id]/tools" } as const;

/** Opens a trip section from outside the trip (a card, a link): a normal push. */
export function openTrip(id: string, section: TripSection = "overview") {
  router.navigate({ pathname: routes[section], params: { id } });
}

/**
 * The section tabs are siblings, not a drill-down: switching replaces the current section,
 * and Overview pops back to the existing overview. The back stack therefore stays
 * [list → overview → one section] however often the user switches.
 */
export function switchTripSection(id: string, from: TripSection, to: TripSection) {
  if (from === to) return;
  if (to === "overview") router.dismissTo({ pathname: routes.overview, params: { id } });
  else if (from === "overview") router.push({ pathname: routes[to], params: { id } });
  else router.replace({ pathname: routes[to], params: { id } });
}

export function TripNavigation({ id, active }: { id: string; active: TripSection }) {
  return <Segments memoryKey={`trip-nav:${id}`} items={[{ value: "overview", label: "Tổng quan" }, { value: "itinerary", label: "Lịch trình" }, { value: "places", label: "Bản đồ" }, { value: "tools", label: "Tiện ích" }]} value={active} onChange={section => switchTripSection(id, active, section)} />;
}
