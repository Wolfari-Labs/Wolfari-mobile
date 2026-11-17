import type { CreateTrip } from "../types";
import { errorMessage } from "../../../shared/api/errors.ts";

type Stored = { key: string; input: CreateTrip; tripId?: string };
type Storage = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> };
type State = { ready: boolean; busy: boolean; pending?: Stored; error?: string };
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
function valid(value: Stored) {
  const input = value?.input;
  return uuid.test(value?.key ?? "") && (!value.tripId || uuid.test(value.tripId)) && input &&
    typeof input.name === "string" && input.name.length > 0 && input.name.length <= 200 &&
    typeof input.timezone === "string" && typeof input.start_at === "string" && typeof input.end_at === "string" &&
    Number.isFinite(Date.parse(input.start_at)) && Date.parse(input.end_at) > Date.parse(input.start_at) &&
    (input.description === undefined || typeof input.description === "string");
}

/** The exact request survives navigation/restart. An uncertain write is never replaced by a new key. */
export function createTripRequest(storage: Storage, scope: string, newId: () => string,
  execute: (input: CreateTrip, key: string) => Promise<{ id: string }>) {
  let state: State = { ready: false, busy: false };
  let loading: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  async function send(pending: Stored, fresh: boolean) {
    try {
      const result = await execute(pending.input, pending.key);
      if (!uuid.test(result?.id ?? "")) throw Error("Chưa nhận được kết quả tạo chuyến đi hợp lệ.");
      const completed = { ...pending, tripId: result.id };
      update({ pending: completed });
      await storage.set(scope, JSON.stringify(completed));
      return result.id;
    } catch (cause) {
      // A replay denial cannot prove that the original request did not commit.
      const status = (cause as { status?: number })?.status;
      if (fresh && [400, 401, 403, 404, 409, 422, 429].includes(status ?? 0) && !state.pending?.tripId) {
        try { await storage.remove(scope); update({ pending: undefined }); } catch { /* Keep blocking until storage can be updated. */ }
      }
      update({ error: errorMessage(cause) });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async load() {
      if (state.ready) return;
      if (!loading) loading = (async () => {
        try {
          const raw = await storage.get(scope);
          const pending = raw ? JSON.parse(raw) as Stored : undefined;
          if (pending && !valid(pending)) throw Error("Invalid saved request");
          update({ ready: true, pending, error: undefined });
        } catch { update({ error: "Chưa đọc được yêu cầu tạo chuyến đi đã lưu. Hãy thử tải lại trước khi tạo chuyến mới." }); }
        finally { loading = undefined; }
      })();
      return loading;
    },
    async start(input: CreateTrip) {
      if (!state.ready || state.busy || state.pending) return;
      update({ busy: true, error: undefined });
      try {
        const pending = { key: newId(), input: JSON.parse(JSON.stringify(input)) as CreateTrip };
        if (!valid(pending)) throw Error("Thông tin chuyến đi chưa hợp lệ.");
        await storage.set(scope, JSON.stringify(pending));
        update({ pending });
        return await send(pending, true);
      } catch { update({ error: "Chưa lưu được yêu cầu trên thiết bị. Chưa gửi chuyến đi lên máy chủ." }); }
      finally { update({ busy: false }); }
    },
    async retry() {
      if (!state.ready || state.busy || !state.pending) return;
      if (state.pending.tripId) return state.pending.tripId;
      update({ busy: true, error: undefined });
      try { return await send(state.pending, false); }
      finally { update({ busy: false }); }
    },
    async acknowledge() {
      if (state.busy || !state.pending?.tripId) return false;
      update({ busy: true });
      try { await storage.remove(scope); update({ pending: undefined, error: undefined }); return true; }
      catch { update({ error: "Chuyến đi đã tạo. Chưa dọn được yêu cầu trên thiết bị; hãy thử mở lại chuyến đi." }); return false; }
      finally { update({ busy: false }); }
    },
  };
}
