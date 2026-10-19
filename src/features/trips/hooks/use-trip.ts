import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";

import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";

export function useTrip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    if (!id || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) throw new Error("Liên kết chuyến đi không hợp lệ.");
    const [trip, plan] = await Promise.all([api.trips.get(id, signal), api.trips.plan(id, signal)]);
    return { trip, plan };
  }, [api, id]));
  return { ...resource, api, id };
}
