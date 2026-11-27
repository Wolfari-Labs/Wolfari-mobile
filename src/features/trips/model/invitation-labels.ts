/** Trip dates on an invitation card ("20/12/2026 – 22/12/2026"); empty when the server omits them. */
export function tripDatesLabel(
  item: { trip_start_at?: string | null; trip_end_at?: string | null },
  timeZone = "Asia/Ho_Chi_Minh",
): string {
  if (!item.trip_start_at || !item.trip_end_at) return "";
  const start = Date.parse(item.trip_start_at),
    end = Date.parse(item.trip_end_at);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  const day = (value: number) =>
    new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(new Date(value));
  return day(start) === day(end) ? day(start) : `${day(start)} – ${day(end)}`;
}

/** "Dùng 1 lần" or, for a group link, how many people have joined out of how many. */
export function invitationUsesLabel(invitation: { max_uses?: number; use_count?: number }): string {
  const max = invitation.max_uses ?? 1;
  if (max <= 1) return "Dùng 1 lần";
  return `Mã nhóm · ${invitation.use_count ?? 0}/${max} người đã vào`;
}

/** People one group code may admit: the server allows 1–50. */
export const GROUP_LINK_USES = 20;
