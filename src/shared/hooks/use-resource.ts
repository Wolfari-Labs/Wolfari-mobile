import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { errorMessage } from "@/shared/api/errors";

// Every focus gets fresh server data. Aborted/older requests cannot overwrite it.
export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string>();
  const active = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    active.current?.abort();
    if (!enabled) { setData(undefined); setLoading(false); return; }
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError(undefined);
    try {
      const value = await loader(controller.signal);
      if (!controller.signal.aborted) setData(value);
      return value;
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [enabled, loader]);
  useFocusEffect(useCallback(() => {
    setData(undefined);
    void reload();
    return () => { active.current?.abort(); };
  }, [reload]));
  return { data, setData, loading, error, reload };
}
