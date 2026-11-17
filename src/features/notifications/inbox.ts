import type { createNotificationsApi } from "./api";

/** Keyset pagination keeps advancing even when marking a page removes it from the unread filter. */
export async function markAllNotificationsRead(api: Pick<ReturnType<typeof createNotificationsApi>, "list" | "markRead">, signal?: AbortSignal) {
  let cursor: string | null = null;
  const seen = new Set<string>();
  let count = 0;
  for (let page = 0; page < 100; page++) {
    signal?.throwIfAborted();
    const result = await api.list({ unread: true, limit: 100, cursor, signal });
    const unread = result.items.filter(item => !item.read_at);
    // Bound concurrent writes so a large inbox does not flood the Gateway.
    for (let i = 0; i < unread.length; i += 4) {
      signal?.throwIfAborted();
      await Promise.all(unread.slice(i, i + 4).map(item => api.markRead(item.id, signal)));
      count += Math.min(4, unread.length - i);
    }
    if (!result.next_cursor) return count;
    if (seen.has(result.next_cursor)) throw Error("Chưa tải được phần thông báo tiếp theo. Hãy thử lại.");
    seen.add(result.next_cursor);
    cursor = result.next_cursor;
  }
  throw Error("Đã xử lý nhiều thông báo. Hãy bấm đánh dấu tất cả lần nữa để tiếp tục phần còn lại.");
}
