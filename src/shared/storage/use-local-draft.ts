import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "@/features/auth/session/session-provider";
import { createDraftStore, draftKey } from "./draft-store";

const store = createDraftStore(AsyncStorage);

export function useLocalDraft<T>(scope: string, feature: string, validate: (value: unknown) => value is T) {
  const { profile } = useSession();
  const key = profile ? draftKey(profile.id, scope, feature) : "";
  const [state, setState] = useState<{ key: string; ready: boolean; value: T | null; error?: string }>({ key: "", ready: false, value: null });
  const [busy, setBusy] = useState(false);
  const activeKey = useRef(key);
  useLayoutEffect(() => { activeKey.current = key; }, [key]);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ key, ready: false, value: null });
    if (key) void store.read(key, validate).then(
      value => { if (active) setState({ key, ready: true, value }); },
      () => { if (active) setState({ key, ready: false, value: null, error: "Không thể đọc bản nháp. Thử mở lại hoặc xóa bản nháp trên thiết bị." }); },
    );
    return () => { active = false; };
  }, [key, validate]));

  const change = useCallback(async (value: T | null) => {
    if (!key || activeKey.current !== key || locked.current) return false;
    if (value !== null && (state.key !== key || !state.ready)) return false;
    locked.current = true;
    setBusy(true);
    try {
      if (value === null) await store.remove(key);
      else {
        if (!validate(value)) throw new Error("Bản nháp không hợp lệ.");
        await store.write(key, value);
      }
      if (mounted.current && activeKey.current === key) setState({ key, ready: true, value });
      return mounted.current && activeKey.current === key;
    } catch {
      if (mounted.current && activeKey.current === key) setState(old => ({ ...old, error: "Chưa lưu được trên thiết bị. Dữ liệu cũ vẫn được giữ; hãy thử lại." }));
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [key, validate, state.key, state.ready]);
  return { value: state.key === key ? state.value : null, ready: state.key === key && state.ready, error: state.key === key ? state.error : undefined, busy, save: change, clear: () => change(null) };
}
