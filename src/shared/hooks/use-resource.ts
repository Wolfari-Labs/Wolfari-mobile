import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { errorMessage } from "@/shared/api/errors";

// Every focus gets fresh server data. Aborted/older requests cannot overwrite it.
export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string>();
  const active = useRef<AbortController | null>(null);
  const background = useRef<AbortController | null>(null);
  const reloading = useRef(false);
  const reload = useCallback(async () => {
    active.current?.abort();
    // A slower background read must not overwrite the data this reload returns.
    background.current?.abort();
    if (!enabled) { setData(undefined); setLoading(false); return; }
    const controller = new AbortController();
    active.current = controller;
    reloading.current = true;
    setLoading(true);
    setError(undefined);
    try {
      const value = await loader(controller.signal);
      if (!controller.signal.aborted) setData(value);
      return value;
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        reloading.current = false;
      }
    }
  }, [enabled, loader]);
  /** Background update: keeps current data and loading state; a failure is ignored. */
  const refresh = useCallback(async () => {
    if (!enabled || reloading.current || background.current) return;
    const controller = new AbortController();
    background.current = controller;
    try {
      const value = await loader(controller.signal);
      if (!controller.signal.aborted) setData(value);
    } catch {
      // The next tick or a manual reload retries.
    } finally {
      if (background.current === controller) background.current = null;
    }
  }, [enabled, loader]);
  useFocusEffect(useCallback(() => {
    setData(undefined);
    void reload();
    return () => {
      active.current?.abort();
      background.current?.abort();
      background.current = null;
      reloading.current = false;
    };
  }, [reload]));
  return { data, setData, loading, error, reload, refresh };
}
