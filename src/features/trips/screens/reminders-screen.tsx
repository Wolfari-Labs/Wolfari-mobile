import { router } from "expo-router";
import { errorMessage } from "@/shared/api/errors";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Details } from "@/shared/ui/details";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { RowIcon } from "@/shared/ui/settings-list";
import { toast } from "@/shared/ui/toast";
import type { PersonalReminder } from "@/features/notifications/api";
import { useTrip } from "../hooks/use-trip";
import { defaultReminderTime, reminderInput, reminderPresets, reminderSources } from "../model/reminders";
import { TIMEZONES } from "../model/timezones";
import { dateLabel, timeLabel } from "../utils";

const PAGE = 6;
const statuses: Record<PersonalReminder["status"], string> = { PENDING: "Chờ đến giờ", PROCESSING: "Đang xử lý", SENT: "Đã tạo thông báo", CANCELLED: "Đã hủy", FAILED: "Chưa gửi được" };
const tones: Record<PersonalReminder["status"], { bg: string; fg: string }> = {
  PENDING: { bg: colors.tealSoft, fg: colors.teal },
  PROCESSING: { bg: colors.butter, fg: colors.amber },
  SENT: { bg: colors.mint, fg: colors.pinGreen },
  CANCELLED: { bg: colors.fill, fg: colors.muted },
  FAILED: { bg: colors.errorSurface, fg: colors.error },
};

/**
 * Personal reminders for one trip. What is already scheduled comes first (that is what
 * people open this page to check); setting a new one is a short pick → one-tap time.
 */
export default function RemindersScreen() {
  const trip = useTrip(), { api, id, data } = trip;
  const reminders = useResource(useCallback((signal: AbortSignal) => api.notifications.reminders(id, signal), [api, id]));
  const command = useCommand();
  const [type, setType] = useState<"ACTIVITY" | "PACKING">("ACTIVITY"), [selected, setSelected] = useState("");
  const [query, setQuery] = useState(""), [date, setDate] = useState(""), [time, setTime] = useState("");
  const [preset, setPreset] = useState<string>("custom");
  const [error, setError] = useState<string>();
  const [shown, setShown] = useState(PAGE);
  const sources = data ? reminderSources(data.plan) : [];
  const packing = type === "PACKING";
  const available = sources.filter(item => item.type === type);
  const search = query.trim().toLocaleLowerCase("vi");
  const visible = available.filter(item => item.label.toLocaleLowerCase("vi").includes(search));
  const source = available.find(item => item.id === selected);
  const tz = data?.trip.timezone ?? "Asia/Ho_Chi_Minh";
  const timezoneLabel = TIMEZONES.find(zone => zone.value === tz)?.label ?? tz;
  const page = visible.slice(0, shown);
  const groups = [...new Set(page.map(item => dateLabel(item.at, tz)))];
  const presets = source ? reminderPresets(source, tz) : [];
  function clearFeedback() {
    setError(undefined);
    command.clearError();
  }
  function resetSelection() {
    setSelected("");
    clearFeedback();
  }
  function choose(item: (typeof sources)[number]) {
    setSelected(item.id);
    const options = reminderPresets(item, tz);
    // Prefer "1 hour before", else the earliest sensible option, else the old default.
    const pick = options.find(option => option.key === "1h") ?? options[0];
    const value = pick ? { date: pick.date, time: pick.time } : defaultReminderTime(item, tz);
    setPreset(pick?.key ?? "custom");
    setDate(value.date); setTime(value.time);
    clearFeedback();
  }
  const archived = data?.trip.lifecycle === "ARCHIVED";
  const enabled = !!data && !archived && !trip.loading && !trip.error;
  async function create() {
    if (!enabled || !data || command.busy) return;
    clearFeedback();
    try {
      const input = reminderInput(source, date, time, data.trip.timezone);
      const result = await command.run(input, key => api.notifications.createReminder(id, input, key));
      if (result) {
        setSelected("");
        toast.success(`Sẽ nhắc bạn lúc ${time} · ${date}.`, { title: "Đã lưu lịch nhắc", icon: "reminderOk" });
        await reminders.reload();
      }
    } catch (cause) { setError(errorMessage(cause, "Kiểm tra giờ nhắc.")); }
  }
  async function cancel(row: PersonalReminder) {
    setError(undefined);
    const result = await command.run({ cancel: row.id }, () => api.notifications.cancelReminder(id, row.id));
    if (result) { toast.info("Đã hủy lịch nhắc."); await reminders.reload(); }
  }
  const labelOf = (row: PersonalReminder) => row.source_type === "PACKING"
    ? data?.plan.packing_items.find(item => item.id === row.source_id)?.name ?? "Nhắc hành lý"
    : data?.plan.activities.find(item => item.id === row.source_id)?.title ?? "Nhắc hoạt động";
  const rows = [...(reminders.data ?? [])].sort((a, b) => Date.parse(a.remind_at) - Date.parse(b.remind_at));
  const upcoming = rows.filter(row => row.status === "PENDING" || row.status === "PROCESSING");
  const past = rows.filter(row => !upcoming.includes(row)).reverse();
  const next = upcoming[0];

  return <Screen title="Lịch nhắc của tôi" onRefresh={() => { void Promise.all([trip.reload(), reminders.reload()]); }} refreshing={trip.loading || reminders.loading}>
    <ResourceFeedback {...trip} hasData={!!data} onRetry={() => { void trip.reload(); }} />
    <View style={styles.summary}>
      <RowIcon icon="bell" tone="peach" size={46} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={typography.headline}>{upcoming.length ? `${upcoming.length} lịch nhắc đang chờ` : "Chưa có lịch nhắc nào chờ"}</Text>
        <Text style={typography.footnote}>{data?.trip.name ?? "Chuyến đi"} · {timezoneLabel}</Text>
        {next && <Text style={typography.footnote} numberOfLines={2}>
          Sắp tới: {labelOf(next)} · {timeLabel(next.remind_at, tz)} {dateLabel(next.remind_at, tz)}
        </Text>}
      </View>
    </View>

    <ResourceFeedback {...reminders} hasData={!!reminders.data} onRetry={() => { void reminders.reload(); }} />
    {upcoming.map(row => <ReminderRow key={row.id} row={row} label={labelOf(row)} tz={tz} busy={command.busy} onCancel={() => { void cancel(row); }} />)}

    {archived && <Text style={typography.footnote}>Chuyến đi đã lưu trữ. Bạn có thể xem lại các lịch nhắc đã đặt.</Text>}
    {data && !archived && <View style={styles.card}>
      <Text accessibilityRole="header" style={typography.section}>Đặt lịch nhắc mới</Text>
      <Segments value={type} items={[{ value: "ACTIVITY", label: "Hoạt động" }, { value: "PACKING", label: "Hành lý" }]} onChange={value => {
        if (command.busy || value === type) return;
        setType(value);
        setShown(PAGE);
        resetSelection();
      }} />
      {source ? <>
        <View style={styles.chosen}>
          <View style={{ flex: 1 }}>
            <Text style={typography.headline}>{source.label}</Text>
            <Text style={typography.footnote}>{source.type === "PACKING" ? "Hạn chuẩn bị" : "Bắt đầu"} {timeLabel(source.at, tz)} · {dateLabel(source.at, tz)}</Text>
          </View>
          <Button label="Đổi mục" compact variant="text" disabled={command.busy} onPress={resetSelection} />
        </View>
        <Text style={styles.label}>Nhắc tôi</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {presets.map(option => <Chip key={option.key} label={option.label} hint={`${option.time} · ${option.date}`} active={preset === option.key} disabled={command.busy}
            onPress={() => { setPreset(option.key); setDate(option.date); setTime(option.time); clearFeedback(); }} />)}
          <Chip label="Tùy chỉnh" active={preset === "custom"} disabled={command.busy} onPress={() => { setPreset("custom"); clearFeedback(); }} />
        </ScrollView>
        {preset === "custom" ? <>
          <DateTimeField label="Ngày nhắc" mode="date" value={date} onChangeText={setDate} editable={!command.busy} />
          <DateTimeField label="Giờ nhắc" mode="time" value={time} onChangeText={setTime} editable={!command.busy} />
        </> : <Text style={typography.footnote}>Nhắc lúc {time} · {date}</Text>}
        {error && <Feedback inline message={error} />}
        <Button label="Lưu lịch nhắc" icon="bell" disabled={!enabled} loading={command.busy} onPress={() => { void create(); }} />
      </> : available.length ? <>
        <FormField label={packing ? "Tìm vật dụng" : "Tìm hoạt động"} icon="search" value={query} onChangeText={value => { setQuery(value); setShown(PAGE); }} maxLength={200} />
        {!visible.length && <View style={styles.empty}>
          <Text style={typography.headline}>Không tìm thấy {packing ? "vật dụng" : "hoạt động"}</Text>
          <Button label="Xóa tìm kiếm" compact variant="text" onPress={() => { setQuery(""); setShown(PAGE); }} />
        </View>}
        {groups.map(group => <View key={group} style={styles.group}>
          <Text style={styles.groupTitle}>{group}</Text>
          {page.filter(item => dateLabel(item.at, tz) === group).map(item => <Pressable key={item.id} cssInterop={false}
            accessibilityRole="button" accessibilityLabel={item.label} accessibilityHint={`${timeLabel(item.at, tz)}. Chọn để đặt giờ nhắc`}
            disabled={command.busy} onPress={() => choose(item)}
            style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}>
            <Text style={styles.optionTime}>{timeLabel(item.at, tz)}</Text>
            <Text numberOfLines={2} style={[typography.body, { flex: 1 }]}>{item.label}</Text>
            <Text style={styles.plus}>＋</Text>
          </Pressable>)}
        </View>)}
        {visible.length > shown && <Button label={`Xem thêm ${Math.min(PAGE, visible.length - shown)} mục`} compact variant="text" onPress={() => setShown(value => value + PAGE)} />}
      </> : <View style={styles.empty}>
        <Text style={typography.headline}>{packing ? "Chưa có vật dụng cần nhắc" : "Chưa có hoạt động sắp tới"}</Text>
        <Text style={typography.footnote}>{packing ? "Thêm hạn chuẩn bị để đặt lịch nhắc." : "Thêm giờ bắt đầu để đặt lịch nhắc."}</Text>
        <Button label={packing ? "Mở hành lý" : "Mở lịch trình"} compact variant="text" icon="chevron" onPress={() => router.push({
          pathname: packing ? "/trip/[id]/packing" : "/trip/[id]/itinerary",
          params: { id },
        })} />
      </View>}
    </View>}
    {command.error && <Feedback message={command.error} />}

    {past.length > 0 && <>
      <Text accessibilityRole="header" style={styles.pastTitle}>Đã qua hoặc đã hủy</Text>
      {past.map(row => <ReminderRow key={row.id} row={row} label={labelOf(row)} tz={tz} busy={command.busy} />)}
    </>}
    <Details title="Khi kế hoạch thay đổi"><Text style={typography.footnote}>Lịch nhắc cũ được hủy khi mục đã hoàn thành, đổi giờ, chuyến đi lưu trữ hoặc bạn không còn tham gia. “Đã tạo thông báo” nghĩa là thông báo đã vào hộp thư; push tùy cài đặt thiết bị.</Text></Details>
  </Screen>;
}

function ReminderRow({ row, label, tz, busy, onCancel }: { row: PersonalReminder; label: string; tz: string; busy: boolean; onCancel?: () => void }) {
  const tone = tones[row.status];
  const live = row.status === "PENDING" || row.status === "PROCESSING";
  return <View style={[styles.record, !live && styles.recordPast]}>
    <View style={styles.time}>
      <Text style={[styles.timeText, !live && { color: colors.muted }]}>{timeLabel(row.remind_at, tz)}</Text>
      <Text style={styles.dateText}>{dateLabel(row.remind_at, tz).slice(0, 5)}</Text>
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text style={typography.headline} numberOfLines={2}>{label}</Text>
      <View style={[styles.status, { backgroundColor: tone.bg }]}><Text style={[styles.statusText, { color: tone.fg }]}>{statuses[row.status]}</Text></View>
      {row.status === "CANCELLED" && row.last_error && <Text style={typography.footnote}>Nguồn hoặc quyền truy cập đã thay đổi.</Text>}
    </View>
    {onCancel && live && <Button label="Hủy" accessibilityLabel={`Hủy lịch nhắc ${label}`} compact variant="text" disabled={busy} onPress={onCancel} />}
  </View>;
}

function Chip({ label, hint, active, disabled, onPress }: { label: string; hint?: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable cssInterop={false} accessibilityRole="radio" accessibilityLabel={hint ? `${label}, ${hint}` : label} accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.75 }]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    {hint && <Text style={[styles.chipHint, active && styles.chipTextActive]}>{hint}</Text>}
  </Pressable>;
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  card: { gap: 12, padding: 16, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.card },
  empty: { gap: 6, alignItems: "flex-start", padding: 14, borderRadius: radii.control, backgroundColor: colors.fill },
  label: { ...typography.eyebrow, textTransform: "uppercase" },
  group: { gap: 6 },
  groupTitle: { color: colors.muted, fontSize: 13, fontFamily: fonts.bold },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.control, backgroundColor: colors.fill },
  optionTime: { minWidth: 48, color: colors.teal, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  plus: { color: colors.teal, fontFamily: fonts.heading, fontSize: 16 },
  chosen: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.control, backgroundColor: colors.tealSoft },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.control, backgroundColor: colors.fill, minHeight: 44, justifyContent: "center" },
  chipActive: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  chipHint: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  chipTextActive: { color: colors.surface },
  record: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  recordPast: { opacity: 0.8, boxShadow: "none", backgroundColor: "rgba(255,255,255,0.6)" },
  time: { width: 58, alignItems: "center", paddingVertical: 6, borderRadius: 14, backgroundColor: colors.fill },
  timeText: { fontFamily: fonts.heading, fontSize: 17, color: colors.teal, fontVariant: ["tabular-nums"] },
  dateText: { ...typography.footnote, fontSize: 12 },
  status: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill },
  statusText: { fontFamily: fonts.bold, fontSize: 12 },
  pastTitle: { ...typography.eyebrow, textTransform: "uppercase", marginTop: 4 },
});
