import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { getApiBaseUrl } from "@/shared/config/env";
import { randomUUID } from "@/shared/operations/operation-id";
import { createTripRequest } from "../model/create-trip-request";
import { createTripStorage } from "../model/create-trip-storage";

const requests = new Map<string, ReturnType<typeof createTripRequest>>();
export function useCreateTripRequest() {
  const api = useApi(), { profile } = useSession();
  const endpoint = Array.from(getApiBaseUrl()).map(char => char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
  const scope = `wolfari.create-trip.v1.${endpoint}.${profile?.id ?? "guest"}`;
  const request = useMemo(() => {
    if (!requests.has(scope)) requests.set(scope, createTripRequest(createTripStorage, scope, randomUUID, api.trips.create));
    return requests.get(scope)!;
  }, [scope, api]);
  const state = useSyncExternalStore(request.subscribe, request.getSnapshot, request.getSnapshot);
  useEffect(() => { if (profile) void request.load(); }, [request, profile]);
  return { ...state, ...request };
}
