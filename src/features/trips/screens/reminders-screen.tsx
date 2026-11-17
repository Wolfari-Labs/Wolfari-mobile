import { errorMessage } from "@/shared/api/errors";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Heading, Notice, ResourceFeedback, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { defaultReminderTime, reminderInput, reminderSources } from "../model/reminders";
import { dateLabel, timeLabel } from "../utils";

const statuses = { PENDING: "Chờ đến giờ", PROCESSING: "Đang xử lý", SENT: "Đã tạo thông báo", CANCELLED: "Đã hủy", FAILED: "Chưa gửi được" };
export default function RemindersScreen() {
  const trip = useTrip(), { api, id, data } = trip;
  const reminders = useResource(useCallback((signal: AbortSignal) => api.notifications.reminders(id, signal), [api, id]));
  const command = useCommand();
  const [type, setType] = useState<"ACTIVITY" | "PACKING">("ACTIVITY"), [selected, setSelected] = useState("");
  const [query, setQuery] = useState(""), [date, setDate] = useState(""), [time, setTime] = useState("");
  const [error, setError] = useState<string>(), [success, setSuccess] = useState<string>();
  const sources = data ? reminderSources(data.plan) : [];
  const visible = sources.filter(item => item.type === type && item.label.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const source = sources.find(item => item.id === selected && item.type === type);
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
    <Notice>Lịch nhắc chỉ dành cho bạn, dùng múi giờ {data?.trip.timezone ?? "của chuyến đi"}. Khi hoạt động/vật dụng đổi giờ, hoàn thành, chuyến đi lưu trữ hoặc bạn mất quyền, lịch nhắc cũ sẽ được hủy khi xử lý. Đặt lại nếu cần.</Notice>
    {enabled && <>
      <Segments value={type} items={[{ value: "ACTIVITY", label: "Hoạt động" }, { value: "PACKING", label: "Hành lý" }]} onChange={value => { if (!command.busy) { setType(value); setSelected(""); setError(undefined); } }} />
      <FormField label="Tìm hoạt động hoặc vật dụng" icon="search" value={query} onChangeText={setQuery} maxLength={200} />
      {!visible.length && <Notice>Chưa có mục phù hợp có giờ bắt đầu/hạn chuẩn bị trong tương lai. Hãy cập nhật lịch trình hoặc hành lý trước.</Notice>}
      {visible.slice(0, 50).map(item => <Button key={item.id} label={`${selected === item.id ? "✓ " : ""}${item.label}`} variant={selected === item.id ? "primary" : "soft"} disabled={command.busy} onPress={() => { setSelected(item.id); const value = defaultReminderTime(item, data!.trip.timezone); setDate(value.date); setTime(value.time); setError(undefined); setSuccess(undefined); }} />)}
      {visible.length > 50 && <Notice>Nhập tên để thu hẹp danh sách; đang hiển thị 50 mục đầu.</Notice>}
      {source && <>
        <Text style={typography.footnote}>Mốc cần chuẩn bị: {dateLabel(source.at, data!.trip.timezone)} {timeLabel(source.at, data!.trip.timezone)}</Text>
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
