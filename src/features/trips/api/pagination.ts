import type { Page } from "../types";

export async function collectPages<T>(fetchPage: (cursor?: string) => Promise<Page<T>>, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = []; const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    if (signal?.aborted) throw new Error("Đã hủy tải dữ liệu.");
    const page = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.next_cursor || undefined;
    if (cursor && seen.has(cursor)) throw new Error("Chưa thể tải hết danh sách. Vui lòng thử lại.");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return items;
}
