import { useIsFocused } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

type Options = {
  /** Last version the screen rendered; undefined until the first load. */
  known: number | undefined;
  /** Cheap read of the current server version. */
  probe: (signal: AbortSignal) => Promise<number | undefined>;
  onChange: () => void;
  /** False while a form, sheet or write is open so a refresh never swaps data under the user. */
  enabled?: boolean;
  intervalMs?: number;
};

/**
 * The backend has no push channel for clients; a versioned GET is the change marker.
 * Polls only while the screen is focused and the app is in the foreground.
 */
export function useLiveVersion({ known, probe, onChange, enabled = true, intervalMs = 6000 }: Options) {
  const focused = useIsFocused();
  const latest = useRef({ known, probe, onChange, enabled });
  useEffect(() => {
    latest.current = { known, probe, onChange, enabled };
  });
  useEffect(() => {
    if (!focused) return;
    let controller: AbortController | undefined;
    const check = async () => {
      const { known: current, enabled: allowed } = latest.current;
      if (!allowed || current === undefined || controller || AppState.currentState !== "active") return;
      controller = new AbortController();
      try {
        const version = await latest.current.probe(controller.signal);
        if (
          !controller.signal.aborted &&
          version !== undefined &&
          version !== latest.current.known &&
          latest.current.enabled
        )
          latest.current.onChange();
      } catch {
        // A failed probe is retried next tick; the screen keeps its data.
      } finally {
        controller = undefined;
      }
    };
    const timer = setInterval(() => void check(), intervalMs);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
      controller?.abort();
    };
  }, [focused, intervalMs]);
}
