/** "vừa xong", "5 phút trước", "3 giờ trước", "hôm qua", "4 ngày trước", or a date. */
export function relativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "chưa ghi nhận";
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return "chưa ghi nhận";
  const seconds = Math.round((now - at) / 1000);
  if (seconds < 0) return "vừa xong";
  if (seconds < 60) return "vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hôm qua";
  if (days < 30) return `${days} ngày trước`;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(at));
}

/** "còn 29 ngày", "còn 5 giờ", "sắp hết hạn". */
export function timeLeft(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "";
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return "";
  const hours = Math.floor((at - now) / 3_600_000);
  if (hours < 1) return "sắp hết hạn";
  if (hours < 48) return `còn ${hours} giờ`;
  return `còn ${Math.floor(hours / 24)} ngày`;
}
