export const DRAFT_TTL = 30 * 24 * 60 * 60 * 1000;
export const DRAFT_LIMIT = 500_000;
export type DraftStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function draftKey(userId: string, scope: string, feature: string) {
  return `wolfari:draft:v1:${[userId, scope, feature].map(encodeURIComponent).join(":")}`;
}

export function decodeDraft<T>(raw: string | null, validate: (value: unknown) => value is T, now = Date.now()): T | null {
  if (!raw) return null;
  if (raw.length > DRAFT_LIMIT) throw new Error("Bản nháp vượt quá giới hạn lưu trữ.");
  const envelope = JSON.parse(raw);
  if (!envelope || envelope.version !== 1 || !Number.isFinite(envelope.savedAt) || !validate(envelope.value)) {
    throw new Error("Bản nháp không tương thích. Hãy xóa bản nháp để bắt đầu lại.");
  }
  if (envelope.savedAt > now + 60_000 || now - envelope.savedAt > DRAFT_TTL) return null;
  return envelope.value;
}

// Serialize writes/removals per key so a slow save cannot resurrect a discarded draft.
export function createDraftStore(storage: DraftStorage) {
  const queues = new Map<string, Promise<unknown>>();
  function enqueue<T>(key: string, work: () => Promise<T>): Promise<T> {
    const task = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(work);
    queues.set(key, task);
    void task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => {});
    return task;
  }
  return {
    read<T>(key: string, validate: (value: unknown) => value is T) {
      return enqueue(key, async () => decodeDraft(await storage.getItem(key), validate));
    },
    write<T>(key: string, value: T) {
      const raw = JSON.stringify({ version: 1, savedAt: Date.now(), value });
      if (raw.length > DRAFT_LIMIT) return Promise.reject(new Error("Bản nháp quá lớn. Hãy giảm số mục."));
      return enqueue(key, () => storage.setItem(key, raw));
    },
    remove(key: string) { return enqueue(key, () => storage.removeItem(key)); },
  };
}
