export function notificationDestination(data?: Record<string, unknown>) {
  const type = typeof data?.type === "string" ? data.type : "";
  const id = typeof data?.trip_id === "string" && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(data.trip_id) ? data.trip_id : undefined;
  if (type === "TRIP_INVITATION") return { screen: "invitation" as const };
  if (!id) return { screen: "notifications" as const };
  const screen = type === "PACKING_REMINDER" ? "packing" : type === "ACTIVITY_REMINDER" ? "itinerary" : /CONTRIBUTION|TRANSFER|CLOSURE|REFUND|FINANCE_CLOSED/.test(type) ? "fund" : type.startsWith("PRICE_") ? "price" : "overview";
  return { screen, tripId: id };
}
