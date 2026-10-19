import type { Activity, Plan } from "./types";

export function activityOrder(activities: Activity[]) {
  return [...activities]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((a) => a.id);
}

/** Replace only this day's slots. Other days and all timestamps stay untouched. */
export function replaceDayOrder(
  allIds: string[],
  dayIds: string[],
  orderedIds: string[],
) {
  const subset = new Set(dayIds);
  if (
    subset.size !== dayIds.length ||
    new Set(allIds).size !== allIds.length ||
    new Set(orderedIds).size !== orderedIds.length ||
    orderedIds.length !== dayIds.length ||
    orderedIds.some((id) => !subset.has(id)) ||
    dayIds.some((id) => !allIds.includes(id))
  ) {
    throw new Error("Danh sách hoạt động đã thay đổi. Hãy tải lại kế hoạch.");
  }
  let index = 0;
  return allIds.map((id) => (subset.has(id) ? orderedIds[index++] : id));
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length)
    return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

type Snapshot = {
  plan?: Plan;
  ids: string[];
  loading: boolean;
  busy: boolean;
  conflict: boolean;
  uncertain: boolean;
  error?: string;
};
type Dependencies = {
  load: (signal: AbortSignal) => Promise<Plan>;
  save: (ids: string[], version: number, key: string) => Promise<unknown>;
  newKey: () => string;
};

/** One atomic, versioned intent; never automatically rebases a collaborator's edits. */
export function createOrderSession(deps: Dependencies) {
  let state: Snapshot = {
    ids: [],
    loading: true,
    busy: false,
    conflict: false,
    uncertain: false,
  };
  let pending: { ids: string[]; version: number; key: string } | undefined;
  let read: AbortController | undefined;
  let disposed = false;
  let committed = false;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<Snapshot>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const dirty = () =>
    !committed &&
    !!state.plan &&
    JSON.stringify(state.ids) !==
      JSON.stringify(activityOrder(state.plan.activities));
  const adopt = (plan: Plan) => {
    committed = false;
    update({
      plan,
      ids: activityOrder(plan.activities),
      conflict: false,
      uncertain: false,
      error: undefined,
    });
  };
  async function reload(discard = false) {
    if (disposed || state.busy || (pending && !discard)) return;
    read?.abort();
    const controller = new AbortController();
    read = controller;
    if (discard || !state.plan) update({ loading: true, error: undefined });
    try {
      const plan = await deps.load(controller.signal);
      if (controller.signal.aborted || disposed) return;
      if (discard || !state.plan || !dirty()) {
        pending = undefined;
        adopt(plan);
      } else if (
        plan.plan_version !== state.plan.plan_version ||
        !plan.permissions.can_edit
      ) {
        update({
          conflict: true,
          error: !plan.permissions.can_edit
            ? "Quyền chỉnh sửa đã thay đổi. Bản nháp chưa được lưu; hãy tải kế hoạch mới."
            : "Một thành viên đã cập nhật kế hoạch. Bản nháp vẫn được giữ; hãy tải bản mới trước khi sắp xếp lại.",
        });
      } else if (!state.conflict) {
        update({ error: undefined });
      }
    } catch (cause) {
      if (controller.signal.aborted || disposed) return;
      const status = (cause as { status?: number })?.status;
      update({
        conflict: state.conflict || status === 403 || status === 404,
        error:
          status === 403 || status === 404
            ? "Bạn không còn quyền truy cập kế hoạch này."
            : "Chưa thể đồng bộ kế hoạch. Kiểm tra kết nối và thử lại.",
      });
    } finally {
      if (!controller.signal.aborted) update({ loading: false });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dirty,
    reload,
    cancelRead() {
      read?.abort();
      update({ loading: false });
    },
    reorder(dayIds: string[], orderedIds: string[]) {
      if (
        !state.plan?.permissions.can_edit ||
        committed ||
        state.busy ||
        state.loading ||
        state.conflict ||
        pending
      )
        return;
      update({
        ids: replaceDayOrder(state.ids, dayIds, orderedIds),
        error: undefined,
      });
    },
    async save() {
      if (
        disposed ||
        state.busy ||
        state.loading ||
        state.conflict ||
        !state.plan?.permissions.can_edit ||
        !dirty()
      )
        return false;
      read?.abort(); // A stale polling read cannot replace a just-saved order.
      pending ??= {
        ids: [...state.ids],
        version: state.plan.plan_version,
        key: deps.newKey(),
      };
      update({ busy: true, error: undefined });
      try {
        await deps.save([...pending.ids], pending.version, pending.key);
        pending = undefined;
        // The editor closes after success. Block another intent until a fresh
        // snapshot is loaded, including a second tap before it has unmounted.
        committed = true;
        update({ uncertain: false });
        return true;
      } catch (cause) {
        const status = (cause as { status?: number })?.status;
        if (
          status === 409 ||
          status === 403 ||
          status === 404 ||
          status === 401 ||
          status === 400
        ) {
          pending = undefined;
          update({
            conflict: true,
            error: state.uncertain
              ? "Không thể xác nhận lần lưu trước: kế hoạch hoặc quyền truy cập đã thay đổi. Lần lưu trước có thể đã thành công; hãy tải bản mới để kiểm tra."
              : status === 409
                ? "Kế hoạch vừa được người khác cập nhật. Không ghi đè thay đổi của họ. Hãy tải bản mới và sắp xếp lại."
                : status === 403 || status === 404
                  ? "Bạn không còn quyền sửa kế hoạch này. Bản nháp chưa được lưu."
                  : "Chưa thể lưu thứ tự. Hãy tải lại kế hoạch và kiểm tra phiên đăng nhập.",
          });
        } else {
          update({
            uncertain: true,
            error:
              "Chưa nhận được xác nhận lưu. Thử lưu lại sẽ dùng cùng mã thao tác để tránh ghi trùng; chưa đổi thứ tự thêm lúc này.",
          });
        }
        return false;
      } finally {
        update({ busy: false });
      }
    },
    dispose() {
      disposed = true;
      read?.abort();
      listeners.clear();
    },
  };
}
