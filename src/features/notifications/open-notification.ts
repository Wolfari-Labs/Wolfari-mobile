import { router } from "expo-router";
import { notificationDestination } from "./destination";

/** Both the inbox and OS push taps resolve through the same validated destination. */
export function openNotification(data?: Record<string, unknown>) {
  const destination = notificationDestination(data);
  if (destination.screen === "invitation") router.push("/invitation");
  else if (!destination.tripId) router.push("/notifications");
  else if (destination.screen === "packing") router.push({ pathname: "/trip/[id]/packing", params: { id: destination.tripId } });
  else if (destination.screen === "itinerary") router.push({ pathname: "/trip/[id]/itinerary", params: { id: destination.tripId } });
  else if (destination.screen === "fund") router.push({ pathname: "/trip/[id]/fund", params: { id: destination.tripId } });
  else if (destination.screen === "price") router.push({ pathname: "/trip/[id]/price-watch", params: { id: destination.tripId } });
  else router.push({ pathname: "/trip/[id]", params: { id: destination.tripId } });
}
