import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";

import { useApi } from "@/shared/api/use-api";
import { useLiveVersion } from "@/shared/hooks/use-live-version";
import { useResource } from "@/shared/hooks/use-resource";

/** `paused` stops background refresh while another editor on the screen owns the plan. */
export function useTrip(paused = false) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    if (!id || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) throw new Error("Liên kết chuyến đi không hợp lệ.");
    const [trip, plan] = await Promise.all([api.trips.get(id, signal), api.trips.plan(id, signal)]);
    return { trip, plan };
  }, [api, id]));
  const refresh = resource.refresh;
  useLiveVersion({
    known: resource.data?.plan.plan_version,
    probe: async (signal) => (await api.trips.plan(id, signal)).plan_version,
    onChange: () => { void refresh(); },
    enabled: !paused && !resource.loading,
    intervalMs: 8000,
  });
  return { ...resource, api, id };
}
