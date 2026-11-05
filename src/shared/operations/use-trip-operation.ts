import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "./operation-id";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { errorMessage } from "@/shared/api/errors";
import { getApiBaseUrl } from "@/shared/config/env";
import { createOperationController, operationTerminal } from "./controller";

const controllers = new Map<string, ReturnType<typeof createOperationController>>();

export function useTripOperation(tripId: string) {
  const api = useApi();
  const { profile } = useSession();
  const userId = profile?.id;
  const scope = JSON.stringify([getApiBaseUrl(), userId, tripId]);
  const controller = useMemo(() => {
    let value = controllers.get(scope);
    if (!value) {
      value = createOperationController({ tripId, storageKey: `wolfari.operation.v1:${scope}`, storage: AsyncStorage,
        uuid: randomUUID, execute: (input, key) => api.finance.execute(input, key),
        poll: key => api.trips.operation(key), message: errorMessage });
      controllers.set(scope, value);
    }
    return value;
  }, [api, scope, tripId]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    const poll = async () => {
      if (!active || AppState.currentState !== "active") return;
      await controller.load();
      if (active && controller.getSnapshot().pending?.operation?.state !== "NEEDS_REVIEW") await controller.check();
    };
    void poll();
    const timer = setInterval(() => { void poll(); }, 5000);
    const listener = AppState.addEventListener("change", state => { if (state === "active") void poll(); });
    return () => { active = false; clearInterval(timer); listener.remove(); };
  }, [controller, userId]));
  return { ...state, ...controller, locked: !state.ready || !!state.pending || state.busy || !userId,
    terminal: operationTerminal(state.pending) };
}
