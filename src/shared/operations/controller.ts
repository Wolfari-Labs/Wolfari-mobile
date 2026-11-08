import type { MembershipOperation } from "../../features/trips/types";

export type OperationCommand = {
  kind: "finance" | "leave" | "remove"; title: string; targetId?: string;
  method: "POST" | "PATCH" | "DELETE"; path: string; body: Record<string, unknown>;
};
export type OperationReceipt = Pick<OperationCommand, "kind" | "title" | "targetId"> & {
  key: string; tripId: string; operation?: MembershipOperation; rejection?: string;
};
type Pending = OperationReceipt & { command?: OperationCommand };
type Snapshot = { ready: boolean; busy: boolean; pending?: Pending; error?: string; sendError?: string; result?: unknown };
type Dependencies = {
  tripId: string; storageKey: string;
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown>; removeItem(key: string): Promise<unknown> };
  uuid(): string; execute(input: OperationCommand, key: string): Promise<unknown>;
  poll(key: string): Promise<MembershipOperation>; message(error: unknown): string;
};
const states = ["PROCESSING", "PENDING_RECOVERY", "NEEDS_REVIEW", "SUCCEEDED", "FAILED"];
export function isOperation(value: unknown): value is MembershipOperation {
  if (!value || typeof value !== "object") return false;
  const row = value as MembershipOperation;
  return typeof row.operation_id === "string" && typeof row.trip_id === "string" && states.includes(row.state)
    && (row.outcome === undefined || (!!row.outcome && ["COMMITTED", "REJECTED", "CANCELLED"].includes(row.outcome.status)));
}
export function operationTerminal(receipt?: OperationReceipt) {
  return !!receipt && (!!receipt.rejection || receipt.operation?.state === "FAILED" || receipt.operation?.state === "SUCCEEDED");
}
export function operationCommitted(receipt?: OperationReceipt) {
  return receipt?.operation?.state === "SUCCEEDED" && receipt.operation.outcome?.status === "COMMITTED";
}
export function receiptForStorage(pending: Pending): OperationReceipt {
  // Persist only the lookup receipt. No bank details, reason, amounts, file keys or auth tokens.
  const operation = pending.operation;
  return { key: pending.key, tripId: pending.tripId, kind: pending.kind, title: pending.title,
    ...(pending.targetId ? { targetId: pending.targetId } : {}),
    ...(operation ? { operation: { operation_id: operation.operation_id, trip_id: operation.trip_id, state: operation.state,
      ...(operation.outcome ? { outcome: { status: operation.outcome.status, ...(operation.outcome.error_code ? { error_code: operation.outcome.error_code } : {}) } } : {}),
      ...(operation.error_code ? { error_code: operation.error_code } : {}),
    } } : {}),
    ...(pending.rejection ? { rejection: pending.rejection } : {}) };
}
export function operationMessage(receipt?: OperationReceipt) {
  if (!receipt) return "";
  if (operationCommitted(receipt)) return "Thao tác đã hoàn tất trên máy chủ.";
  const code = receipt.rejection ?? receipt.operation?.error_code ?? receipt.operation?.outcome?.error_code;
  if (code === "FINANCE_OBLIGATION_BLOCKED") return "Chưa thể rời hoặc xóa thành viên: cần xử lý giao dịch đang chờ, hoàn tiền hoặc quỹ đang giữ. Khoản PENDING đủ điều kiện sẽ được máy chủ miễn; lịch sử tiền được giữ nguyên.";
  if (code === "VERSION_CONFLICT") return "Dữ liệu quỹ hoặc thành viên đã thay đổi. Tải lại rồi kiểm tra trước khi gửi yêu cầu mới.";
  if (code === "STATE_CONFLICT") return "Trạng thái chưa cho phép thao tác: kiểm tra số dư khả dụng, giao dịch đang chờ, phiên đóng quỹ và cấu hình backend.";
  if (receipt.operation?.state === "NEEDS_REVIEW") return "Yêu cầu cần bộ phận vận hành kiểm tra. Giữ mã yêu cầu; không tạo yêu cầu khác.";
  if (operationTerminal(receipt)) return "Yêu cầu không được ghi nhận thành công. Tải lại dữ liệu trước khi thực hiện thao tác khác.";
  if (receipt.operation) return "Máy chủ đang xử lý. Chưa xác nhận thành công; app sẽ kiểm tra lại khi màn hình đang mở.";
  return "Chưa xác định được kết quả. Kiểm tra trạng thái hoặc gửi lại cùng yêu cầu; không tạo yêu cầu mới.";
}

// One controller per Gateway/account/trip, shared by Finance and membership screens.
export function createOperationController(deps: Dependencies) {
  let snapshot: Snapshot = { ready: false, busy: false };
  let loading: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<Snapshot>) => { snapshot = { ...snapshot, ...patch }; listeners.forEach(fn => fn()); };
  async function persist(receipt: Pending) {
    await deps.storage.setItem(deps.storageKey, JSON.stringify(receiptForStorage(receipt)));
  }
  async function load() {
    if (snapshot.ready) return;
    if (loading) return loading;
    loading = (async () => {
      try {
        const raw = await deps.storage.getItem(deps.storageKey);
        let pending: Pending | undefined;
        if (raw) {
          const row = JSON.parse(raw) as OperationReceipt;
          if (row.tripId !== deps.tripId || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(row.key) || !["finance", "leave", "remove"].includes(row.kind) || typeof row.title !== "string" || (row.operation && (!isOperation(row.operation) || row.operation.operation_id !== row.key || row.operation.trip_id !== deps.tripId)))
            throw new Error("Mã thao tác đã lưu không hợp lệ. Cần kiểm tra trước khi ghi dữ liệu mới.");
          pending = receiptForStorage(row);
        }
        update({ ready: true, pending, error: undefined });
      } catch { update({ error: "Không đọc được mã yêu cầu đã lưu. Chưa thể ghi mới; hãy thử tải lại." }); }
      finally { loading = undefined; }
    })();
    return loading;
  }
  async function receive(operation: MembershipOperation) {
    const pending = snapshot.pending;
    if (!pending || operationTerminal(pending)) return;
    if (!isOperation(operation) || operation.operation_id !== pending.key || operation.trip_id !== deps.tripId) throw new Error("Kết quả thao tác không khớp yêu cầu. Giữ mã yêu cầu để kiểm tra.");
    if (operation.state === "SUCCEEDED" && !operation.outcome) throw new Error("Máy chủ chưa trả kết quả hoàn tất hợp lệ.");
    const next = { ...pending, operation, ...(["SUCCEEDED", "FAILED"].includes(operation.state) ? { command: undefined } : {}) };
    update({ pending: next, error: undefined });
    await persist(next);
  }
  async function execute(pending: Pending, fresh: boolean) {
    if (!pending.command) return;
    try {
      const result = await deps.execute(pending.command, pending.key);
      if (result && typeof result === "object" && "operation_id" in result && result.operation_id !== pending.key)
        throw new Error("Kết quả thao tác không khớp yêu cầu. Giữ mã yêu cầu để kiểm tra.");
      if (isOperation(result)) await receive(result);
      else {
        // Reminder's {accepted:true} means queued, not a delivered notification.
        if (!result || typeof result !== "object" || !("id" in result || ("deleted" in result && result.deleted === true) || ("accepted" in result && result.accepted === true && "closure_id" in result && (!('operation_id' in result) || result.operation_id === pending.key)))) throw new Error("Phản hồi chưa xác định. Kiểm tra bằng mã yêu cầu.");
        await receive({ operation_id: pending.key, trip_id: deps.tripId, state: "SUCCEEDED", outcome: { status: "COMMITTED" } });
      }
      // Keep response details in memory only (for example a Sandbox payment URL).
      if (operationCommitted(snapshot.pending)) update({ result });
    } catch (cause) {
      const error = cause as { status?: number; code?: string };
      // A denial during replay cannot disprove a previously committed request.
      if (fresh && [400, 401, 403, 404, 409, 422].includes(error.status ?? 0) && !operationTerminal(snapshot.pending)) {
        const rejected = { ...pending, command: undefined, rejection: error.code ?? "REQUEST_REJECTED" };
        update({ pending: rejected });
        try { await persist(rejected); } catch { /* Original lookup receipt is still durable. */ }
      }
      update({ error: deps.message(cause), sendError: deps.message(cause) });
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    load,
    async run(command: OperationCommand) {
      if (!snapshot.ready || snapshot.busy || snapshot.pending) return false;
      update({ busy: true, error: undefined, result: undefined });
      try {
        const frozen = JSON.parse(JSON.stringify(command)) as OperationCommand;
        const pending: Pending = { ...receiptForStorage({ ...frozen, key: deps.uuid(), tripId: deps.tripId }), command: frozen };
        // Do not issue a mutation if we cannot durably remember its operation ID.
        await persist(pending);
        update({ pending, sendError: undefined });
        await execute(pending, true);
        return true;
      } catch { update({ error: "Không lưu được mã yêu cầu. Chưa gửi thay đổi lên máy chủ." }); return false; }
      finally { update({ busy: false }); }
    },
    async retry() {
      const pending = snapshot.pending;
      if (snapshot.busy || !pending?.command || operationTerminal(pending) || pending.operation?.state === "NEEDS_REVIEW") return;
      update({ busy: true, error: undefined });
      try { await execute(pending, false); } finally { update({ busy: false }); }
    },
    async check() {
      const pending = snapshot.pending;
      if (!pending || snapshot.busy || operationTerminal(pending)) return;
      update({ busy: true });
      try { await receive(await deps.poll(pending.key)); }
      catch (cause) {
        const notFound = (cause as { status?: number }).status === 404;
        // 404 with no server acknowledgement: the request most likely never reached the Trip service.
        update({ error: notFound
          ? (pending.operation ? "Chưa tìm thấy kết quả. Mã yêu cầu vẫn được giữ; 404 không chứng minh thao tác thất bại."
            : `Máy chủ chưa ghi nhận yêu cầu này${snapshot.sendError ? ` (lỗi khi gửi: ${snapshot.sendError})` : ""}. Bạn có thể bỏ yêu cầu và thử lại.`)
          : deps.message(cause) });
      } finally { update({ busy: false }); }
    },
    // Drop a request the server never acknowledged (no operation receipt), so the trip is not locked forever.
    async discard() {
      const pending = snapshot.pending;
      if (snapshot.busy || !pending || pending.operation) return false;
      update({ busy: true });
      try {
        await deps.storage.removeItem(deps.storageKey);
        update({ pending: undefined, error: undefined, sendError: undefined });
        return true;
      } catch { update({ error: "Không xóa được mã yêu cầu đã lưu. Hãy thử lại." }); return false; }
      finally { update({ busy: false }); }
    },
    async acknowledge() {
      if (snapshot.busy || !operationTerminal(snapshot.pending)) return false;
      update({ busy: true });
      try {
        await deps.storage.removeItem(deps.storageKey);
        update({ pending: undefined, error: undefined, sendError: undefined });
        return true;
      } catch { update({ error: "Không cập nhật được mã yêu cầu đã lưu. Hãy thử lại." }); return false; }
      finally { update({ busy: false }); }
    },
  };
}
