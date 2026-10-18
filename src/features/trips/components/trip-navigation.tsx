import { router } from "expo-router";

import { Segments } from "@/shared/ui/journal";

export type TripSection = "overview" | "itinerary" | "places" | "tools";
export function openTrip(id: string, section: TripSection = "overview") {
  const routes = { overview: "/trip/[id]", itinerary: "/trip/[id]/itinerary", places: "/trip/[id]/places", tools: "/trip/[id]/tools" } as const;
  router.navigate({ pathname: routes[section], params: { id } });
}
export function TripNavigation({ id, active }: { id: string; active: TripSection }) {
  return <Segments items={[{ value: "overview", label: "Tổng quan" }, { value: "itinerary", label: "Lịch trình" }, { value: "places", label: "Bản đồ" }, { value: "tools", label: "Tiện ích" }]} value={active} onChange={section => openTrip(id, section)} />;
}
