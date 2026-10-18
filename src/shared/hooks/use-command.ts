import { randomUUID } from "expo-crypto";
import { useRef, useState } from "react";

import { ApiError } from "@/shared/api/api-client";
import { errorMessage } from "@/shared/api/errors";

export function useCommand() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef<{ intent: string; key: string } | null>(null);
  const locked = useRef(false);

  async function run<T>(intent: unknown, work: (key: string) => Promise<T>): Promise<T | undefined> {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    const signature = JSON.stringify(intent);
    if (pending.current?.intent !== signature) pending.current = { intent: signature, key: randomUUID() };
    try {
      const value = await work(pending.current.key);
      pending.current = null;
      return value;
    } catch (cause) {
      // Retain the same operation ID after a lost response: retry cannot duplicate a write.
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) pending.current = null;
      setError(errorMessage(cause));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run, clearError: () => setError(undefined) };
}
