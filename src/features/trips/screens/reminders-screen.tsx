import { errorMessage } from "@/shared/api/errors";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, fonts, radii, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Details } from "@/shared/ui/details";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Heading, Notice, ResourceFeedback, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { defaultReminderTime, reminderInput, reminderSources } from "../model/reminders";
import { dateLabel, timeLabel } from "../utils";

const PAGE = 8;
const statuses = { PENDING: "Chờ đến giờ", PROCESSING: "Đang xử lý", SENT: "Đã tạo thông báo", CANCELLED: "Đã hủy", FAILED: "Chưa gửi được" };
export default function RemindersScreen() {
  const trip = useTrip(), { api, id, data } = trip;
  const reminders = useResource(useCallback((signal: AbortSignal) => api.notifications.reminders(id, signal), [api, id]));
  const command = useCommand();
  const [type, setType] = useState<"ACTIVITY" | "PACKING">("ACTIVITY"), [selected, setSelected] = useState("");
  const [query, setQuery] = useState(""), [date, setDate] = useState(""), [time, setTime] = useState("");
  const [error, setError] = useState<string>(), [success, setSuccess] = useState<string>();
  const [shown, setShown] = useState(PAGE);
  const sources = data ? reminderSources(data.plan) : [];
  const visible = sources.filter(item => item.type === type && item.label.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const source = sources.find(item => item.id === selected && item.type === type);
  const tz = data?.trip.timezone ?? "Asia/Ho_Chi_Minh";
  // Grouped by day in time order, so a long plan reads like a calendar instead of a button wall.
  const page = [...visible].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(0, shown);
  const groups = [...new Set(page.map(item => dateLabel(item.at, tz)))];
  function choose(item: (typeof sources)[number]) {
    setSelected(item.id);
    const value = defaultReminderTime(item, tz);
    setDate(value.date); setTime(value.time); setError(undefined); setSuccess(undefined);
  }
  const enabled = !!data && data.trip.lifecycle !== "ARCHIVED" && !trip.loading && !trip.error;
  async function create() {
    if (!enabled || !data || command.busy) return;
    setError(undefined); setSuccess(undefined);
    try {
      const input = reminderInput(source, date, time, data.trip.timezone);
      const result = await command.run(input, key => api.notifications.createReminder(id, input, key));
      if (result) { setSelected(""); setSuccess("Đã lưu lịch nhắc của bạn. Thông báo sẽ được tạo khi đến giờ; push tùy cài đặt thiết bị."); await reminders.reload(); }
    } catch (cause) { setError(errorMessage(cause, "Kiểm tra giờ nhắc.")); }
  }
  return <Screen title="Lịch nhắc của tôi" onRefresh={() => { void Promise.all([trip.reload(), reminders.reload()]); }} refreshing={trip.loading || reminders.loading}>
    <Heading title="Nhớ những điều cần làm" subtitle={data?.trip.name} />
    <ResourceFeedback {...trip} hasData={!!data} onRetry={() => { void trip.reload(); }} />
    <Text style={typography.footnote}>Lịch nhắc riêng · Múi giờ {data?.trip.timezone ?? "của chuyến đi"}</Text>
    <Details title="Khi kế hoạch thay đổi"><Text style={typography.footnote}>Lịch nhắc cũ được hủy khi mục đã hoàn thành, đổi giờ, chuyến đi lưu trữ hoặc bạn không còn tham gia. Đặt lại lịch nếu cần.</Text></Details>
    {enabled && <>
      <Segments value={type} items={[{ value: "ACTIVITY", label: "Hoạt động" }, { value: "PACKING", label: "Hành lý" }]} onChange={value => { if (!command.busy) { setType(value); setSelected(""); setShown(PAGE); setError(undefined); } }} />
      {source ? <View style={styles.chosen}>
        <View style={{ flex: 1 }}>
          <Text style={typography.headline}>{source.label}</Text>
          <Text style={typography.footnote}>{source.type === "PACKING" ? "Hạn chuẩn bị" : "Bắt đầu"} {dateLabel(source.at, tz)} · {timeLabel(source.at, tz)}</Text>
        </View>
        <Button label="Đổi mục" compact variant="soft" disabled={command.busy} onPress={() => setSelected("")} />
      </View> : <>
        <FormField label="Tìm hoạt động hoặc vật dụng" icon="search" value={query} onChangeText={value => { setQuery(value); setShown(PAGE); }} maxLength={200} />
        {!visible.length && <Notice>Chưa có mục phù hợp có giờ bắt đầu/hạn chuẩn bị trong tương lai. Hãy cập nhật lịch trình hoặc hành lý trước.</Notice>}
        {groups.map(group => <View key={group} style={styles.group}>
          <Text style={styles.groupTitle}>{group}</Text>
          {page.filter(item => dateLabel(item.at, tz) === group).map(item => <Pressable key={item.id} cssInterop={false}
            accessibilityRole="button" accessibilityLabel={item.label} accessibilityHint={`${timeLabel(item.at, tz)}. Chọn để đặt giờ nhắc`}
            disabled={command.busy} onPress={() => choose(item)}
            style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}>
            <Text style={styles.optionTime}>{timeLabel(item.at, tz)}</Text>
            <Text numberOfLines={2} style={[typography.body, { flex: 1 }]}>{item.label}</Text>
          </Pressable>)}
        </View>)}
        {visible.length > shown && <Button label={`Xem thêm ${Math.min(PAGE, visible.length - shown)} mục`} compact variant="soft" onPress={() => setShown(value => value + PAGE)} />}
      </>}
      {source && <>
        <DateTimeField label="Ngày nhắc" mode="date" value={date} onChangeText={setDate} editable={!command.busy} />
        <DateTimeField label="Giờ nhắc" mode="time" value={time} onChangeText={setTime} editable={!command.busy} />
        <Button label="Lưu lịch nhắc" loading={command.busy} onPress={() => { void create(); }} />
      </>}
    </>}
    {(error || command.error) && <Feedback message={error ?? command.error!} />}
    {success && <Feedback success message={success} />}
    <Text accessibilityRole="header" style={typography.section}>Lịch nhắc đã đặt</Text>
    <ResourceFeedback {...reminders} hasData={!!reminders.data} onRetry={() => { void reminders.reload(); }} />
    {reminders.data?.length === 0 && <EmptyState title="Bạn chưa đặt lịch nhắc" message="Chọn hoạt động hoặc vật dụng phía trên để đặt giờ." />}
    {reminders.data?.map(row => {
      const label = sources.find(item => item.id === row.source_id && item.type === row.source_type)?.label ?? (row.source_type === "PACKING" ? "Nhắc hành lý" : "Nhắc hoạt động");
      return <View key={row.id} style={ui.record}>
      <Text style={typography.headline}>{label}</Text>
      <Text style={typography.body}>{dateLabel(row.remind_at, data?.trip.timezone)} {timeLabel(row.remind_at, data?.trip.timezone ?? "Asia/Ho_Chi_Minh")}</Text>
      <Text style={typography.footnote}>{statuses[row.status]}</Text>
      {row.status === "SENT" && <Text style={typography.footnote}>Xem trong hộp thông báo. Trạng thái này chưa xác nhận điện thoại đã nhận push.</Text>}
      {row.status === "CANCELLED" && row.last_error && <Text style={typography.footnote}>Nguồn hoặc quyền truy cập đã thay đổi.</Text>}
      {["PENDING", "PROCESSING"].includes(row.status) && <Button label="Hủy lịch nhắc" accessibilityLabel={`Hủy lịch nhắc ${label}`} compact variant="destructive" disabled={command.busy} onPress={() => { void (async () => { const result = await command.run({ cancel: row.id }, () => api.notifications.cancelReminder(id, row.id)); if (result) await reminders.reload(); })(); }} />}
    </View>; })}
  </Screen>;
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  groupTitle: { color: colors.muted, fontSize: 13, fontFamily: fonts.bold },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
  },
  optionTime: { minWidth: 48, color: colors.teal, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  chosen: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.card, backgroundColor: colors.tealSoft },
});
