import { ApiError } from '../../shared/api/api-client.ts';
import type { WriteIntent } from './api.ts';

export interface JournalStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
export function createCommandJournal(storage: JournalStorage, scope: string) {
  let pending: WriteIntent | null = null;
  let busy = false;
  async function clear() {
    await storage.remove(scope);
    pending = null;
  }
  return {
    get pending() {
      return pending;
    },
    get busy() {
      return busy;
    },
    async restore() {
      if (busy || pending) return;
      const raw = await storage.get(scope);
      if (raw) {
        const v = JSON.parse(raw) as WriteIntent;
        if (
          !v.key ||
          !v.path?.startsWith('/') ||
          v.path.startsWith('//') ||
          !['POST', 'PATCH', 'PUT', 'DELETE'].includes(v.method) ||
          !v.body ||
          !['finance', 'watch'].includes(v.kind)
        )
          throw Error('Yêu cầu lưu trên máy không hợp lệ; liên hệ hỗ trợ, chưa gửi yêu cầu mới.');
        pending = v;
      }
    },
    async send(intent: WriteIntent | undefined, write: (i: WriteIntent) => Promise<unknown>) {
      if (busy) throw Error('Yêu cầu đang được xử lý.');
      if (intent && pending) throw Error('Cần đối chiếu yêu cầu trước trước khi tạo yêu cầu mới.');
      if (!intent && !pending) throw Error('Không có yêu cầu cần gửi lại.');
      busy = true;
      const retry = !!pending;
      try {
        if (intent) {
          await storage.set(scope, JSON.stringify(intent));
          pending = JSON.parse(JSON.stringify(intent)) as WriteIntent;
        }
        const saved = pending!;
        saved.attempted = true;
        await storage.set(scope, JSON.stringify(saved));
        try {
          const result = await write(saved);
          if (result && typeof result === 'object' && 'operation_id' in result) {
            const op = result as Record<string, unknown>;
            if (op.operation_id !== saved.key)
              throw new ApiError('INVALID_RESPONSE', 'Mã xử lý không khớp.');
            const outcome = op.outcome as { status?: string } | null;
            if (
              (op.accepted === true && typeof op.closure_id === 'string') ||
              (op.state === 'SUCCEEDED' && outcome?.status === 'COMMITTED')
            ) {
              await clear();
              return { done: true, result };
            }
            return { done: false, result };
          }
          await clear();
          return { done: true, result };
        } catch (error) {
          // An uncertain retry must not be discarded on 403/409: the first request may have committed.
          if (
            !retry &&
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![408, 425, 429].includes(error.status) &&
            !error.retryable
          )
            await clear();
          throw error;
        }
      } finally {
        busy = false;
      }
    },
    async check(read: (key: string) => Promise<unknown>, keepForReplay = false) {
      if (!pending || busy) throw Error('Chưa có yêu cầu cần kiểm tra.');
      busy = true;
      try {
        const result = (await read(pending.key)) as Record<string, unknown>;
        if (result.operation_id !== pending.key) throw Error('Mã yêu cầu không khớp.');
        const outcome = result.outcome as { status?: string } | null;
        if (result.state === 'SUCCEEDED' && outcome?.status === 'COMMITTED') {
          if (!keepForReplay) await clear();
          return true;
        }
        if (
          result.state === 'FAILED' &&
          ['REJECTED', 'CANCELLED'].includes(outcome?.status ?? '')
        ) {
          await clear();
          throw Error(
            'Server xác nhận yêu cầu không hoàn tất. Hãy tải lại dữ liệu trước khi thử thao tác mới.',
          );
        }
        throw Error(
          result.state === 'NEEDS_REVIEW'
            ? 'Yêu cầu cần vận hành kiểm tra; giữ mã yêu cầu và không gửi lệnh mới.'
            : 'Server đang xử lý; kiểm tra lại sau.',
        );
      } finally {
        busy = false;
      }
    },
    async acknowledgeWatch() {
      if (pending?.kind !== 'watch' || busy) throw Error('Không thể đóng yêu cầu này.');
      await clear();
    },
  };
}
