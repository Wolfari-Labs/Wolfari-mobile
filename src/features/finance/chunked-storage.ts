import type { JournalStorage } from './command.ts';
// Publish the pointer only after every encrypted chunk is stored. 400 Unicode
// code points are <=1600 UTF-8 bytes; never split an emoji's surrogate pair.
export function chunkedStorage(base: JournalStorage, newId: () => string): JournalStorage {
  const parse = (raw: string) => {
    const value = JSON.parse(raw) as { id: string; count: number };
    if (
      !/^[a-zA-Z0-9-]+$/.test(value.id) ||
      !Number.isInteger(value.count) ||
      value.count < 1 ||
      value.count > 250
    )
      throw Error('Nhật ký trên thiết bị không hợp lệ.');
    return value;
  };
  async function clean(key: string, raw: string | null) {
    if (!raw) return;
    const { id, count } = parse(raw);
    await Promise.allSettled(
      Array.from({ length: count }, (_, i) => base.remove(`${key}.${id}.${i}`)),
    );
  }
  return {
    async get(key) {
      const raw = await base.get(key);
      if (!raw) return null;
      const { id, count } = parse(raw);
      const pieces = await Promise.all(
        Array.from({ length: count }, (_, i) => base.get(`${key}.${id}.${i}`)),
      );
      if (pieces.some((p) => p === null))
        throw Error(
          'Thiếu dữ liệu yêu cầu đã lưu; chưa gửi yêu cầu mới. Liên hệ hỗ trợ để đối chiếu.',
        );
      return pieces.join('');
    },
    async set(key, value) {
      if (!value || value.length > 100000)
        throw Error('Yêu cầu quá lớn để lưu an toàn trên thiết bị.');
      const old = await base.get(key),
        id = newId(),
        points = Array.from(value),
        count = Math.ceil(points.length / 400);
      for (let i = 0; i < count; i++)
        await base.set(`${key}.${id}.${i}`, points.slice(i * 400, (i + 1) * 400).join(''));
      await base.set(key, JSON.stringify({ id, count }));
      await clean(key, old);
    },
    async remove(key) {
      const old = await base.get(key);
      await base.remove(key);
      await clean(key, old);
    },
  };
}
