import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { ApiError } from "@/shared/api/api-client";
import { useCommand } from "@/shared/hooks/use-command";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Heading, ResourceFeedback, Segments, ui } from "@/shared/ui/journal";
import { MoneyField } from "@/shared/ui/money-field";
import { SnapshotConflict } from "@/shared/ui/snapshot-conflict";
import { Screen } from "@/shared/ui/screen";
import { coverFor } from "../components/trip-card";
import { coverBody, coverProblem, TripCoverImage } from "../components/trip-cover";
import { useTrip } from "../hooks/use-trip";
import { money } from "../model/local-parity";
import { TIMEZONES } from "../model/timezones";
import { calendarLabel, dateKey, lastTripDay, localTimestamp, parseDate } from "../utils";

export default function EditTripScreen() {
  const resource = useTrip();
  const [edition, setEdition] = useState(0);
  if (!resource.data) return <Screen title="Chỉnh sửa chuyến đi"><ResourceFeedback {...resource} hasData={false} onRetry={() => { void resource.reload(); }} /></Screen>;
  if (!resource.data.trip.permissions.can_update) return <Screen title="Chỉnh sửa chuyến đi"><EmptyState title="Thông tin của nhóm" message="Bạn chưa có quyền cập nhật thông tin chuyến đi." /></Screen>;
  return <EditTripForm key={edition} resource={resource} onReplace={() => setEdition(value => value + 1)} />;
}

const RANGE_CONFLICT = "Một số hoạt động hoặc dress code theo ngày đang nằm ngoài khoảng ngày mới. Hãy dời chúng vào trong khoảng ngày mới (hoặc chuyển về Chưa xếp lịch) rồi đổi ngày lại.";

function EditTripForm({ resource, onReplace }: { resource: ReturnType<typeof useTrip>; onReplace(): void }) {
  const { trip } = resource.data!; const command = useCommand();
  const [base] = useState(trip);
  const stale = trip.plan_version !== base.plan_version || trip.export_revision !== base.export_revision;
  const blocked = stale || resource.loading || !!resource.error;
  const firstDay = calendarLabel(dateKey(base.start_at, base.timezone)), lastDay = calendarLabel(lastTripDay(base));
  const [name, setName] = useState(trip.name); const [description, setDescription] = useState(trip.description ?? ""); const [publicDescription, setPublicDescription] = useState(trip.public_description ?? "");
  const [start, setStart] = useState(firstDay); const [end, setEnd] = useState(lastDay); const [timezone, setTimezone] = useState(trip.timezone);
  const [budget, setBudget] = useState(trip.budget_amount ?? "");
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset | null>();
  const [validation, setValidation] = useState<string>();
  async function chooseCover() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: false });
      if (result.canceled) return;
      const problem = coverProblem(result.assets[0]);
      if (problem) { setValidation(problem); return; }
      setValidation(undefined); setCover(result.assets[0]);
    } catch { setValidation("Không mở được thư viện ảnh. Hãy thử lại."); }
  }
  async function save() {
    if (blocked || command.busy) return;
    if (!name.trim() || name.trim().length > 200) { setValidation("Tên chuyến đi cần từ 1 đến 200 ký tự."); return; }
    const first = parseDate(start), last = parseDate(end);
    if (!first || !last) { setValidation("Chọn ngày đi và ngày về hợp lệ."); return; }
    if (last < first) { setValidation("Ngày về cần bằng hoặc sau ngày đi."); return; }
    if (budget && !money(budget)) { setValidation("Ngân sách là số nguyên VND lớn hơn 0, tối đa 12 chữ số."); return; }
    const zoneChanged = timezone !== base.timezone;
    // Only send what changed, so a trip that starts at a set hour keeps it unless its day changes.
    const startAt = zoneChanged || start !== firstDay ? localTimestamp(first, "00:00", timezone) : undefined;
    const endAt = zoneChanged || end !== lastDay ? localTimestamp(last, "23:59", timezone) : undefined;
    if ((zoneChanged || start !== firstDay) && !startAt) { setValidation("Ngày đi chưa hợp lệ với múi giờ đã chọn."); return; }
    if ((zoneChanged || end !== lastDay) && !endAt) { setValidation("Ngày về chưa hợp lệ với múi giờ đã chọn."); return; }
    setValidation(undefined);
    const nextBudget = budget ? String(money(budget)) : null;
    const input = {
      name: name.trim(), description: description.trim() || null, public_description: publicDescription.trim() || null,
      ...(startAt ? { start_at: startAt } : {}), ...(endAt ? { end_at: endAt } : {}), ...(zoneChanged ? { timezone } : {}),
      ...(nextBudget !== (base.budget_amount ?? null) ? { budget_amount: nextBudget } : {}),
    };
    const result = await command.run({ ...input, cover: cover === undefined ? "keep" : cover?.uri ?? "remove", version: base.plan_version, revision: base.export_revision }, async key => {
      try {
        await resource.api.trips.update(base, input, key);
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === "STATE_CONFLICT" && (startAt || endAt)) throw new Error(RANGE_CONFLICT);
        throw cause;
      }
      // Cover changes follow the metadata write; a failure here leaves the saved fields intact.
      try {
        if (cover) await resource.api.trips.uploadCover(base.id, coverBody(cover));
        else if (cover === null) await resource.api.trips.removeCover(base.id);
      } catch {
        throw new Error("Đã lưu thông tin chuyến đi nhưng chưa cập nhật được ảnh bìa. Hãy thử đổi ảnh lại.");
      }
      return true;
    });
    if (result) router.replace({ pathname: "/trip/[id]/settings", params: { id: trip.id } });
  }
  return <Screen title="Chỉnh sửa chuyến đi" bottomPadding={24} footer={<Button label="Lưu thay đổi" disabled={blocked} loading={command.busy} onPress={() => { void save(); }} />}>
    <TripCoverImage trip={trip} fallback={coverFor(trip)} preview={cover ? cover.uri : undefined} style={{ width: "100%", height: 166, borderRadius: 24 }} />
    <View style={[ui.row, { flexWrap: "wrap" }]}>
      <Button label={trip.cover_image_available || cover ? "Đổi ảnh bìa" : "Thêm ảnh bìa"} variant="soft" compact disabled={command.busy} onPress={() => { void chooseCover(); }} />
      {(cover || (trip.cover_image_available && cover !== null)) && <Button label="Gỡ ảnh bìa" variant="text" compact disabled={command.busy} onPress={() => setCover(trip.cover_image_available ? null : undefined)} />}
      {cover === null && <Text style={typography.footnote}>Ảnh bìa sẽ được gỡ khi lưu.</Text>}
    </View>
    <Heading title={trip.name} subtitle="Cập nhật thông tin cho cả nhóm." />
    <SnapshotConflict stale={stale} disabled={resource.loading || !!resource.error} onReplace={onReplace} />
    {resource.error && <Feedback message={resource.error} />}
    {validation && <Feedback message={validation} />}{command.error && <><Feedback message={command.error} /><Button label="Tải thông tin mới nhất" variant="soft" compact onPress={() => { void resource.reload(); }} /></>}
    <FormField label="Tên chuyến đi" icon="trip" value={name} onChangeText={setName} maxLength={200} editable={!command.busy} />
    <DateTimeField label="Ngày đi" value={start} editable={!command.busy} onChangeText={value => {
      setStart(value);
      const a = parseDate(value), b = parseDate(end);
      if (a && b && b < a) setEnd(value);
    }} />
    <DateTimeField label="Ngày về" value={end} minimum={parseDate(start) ? start : undefined} editable={!command.busy} onChangeText={setEnd} />
    <Text style={typography.footnote}>Múi giờ chuyến đi</Text>
    <Segments scroll value={timezone} onChange={value => { if (!command.busy) setTimezone(value); }} items={TIMEZONES.some(item => item.value === base.timezone) ? TIMEZONES : [{ value: base.timezone, label: base.timezone }, ...TIMEZONES]} />
    <Text style={typography.footnote}>Hoạt động đã xếp lịch phải nằm trong khoảng ngày mới.</Text>
    <MoneyField label="Ngân sách dự kiến (VND)" value={budget} onChangeText={setBudget} maxDigits={12} editable={!command.busy} />
    <FormField label="Mô tả cho nhóm" icon="edit" value={description} onChangeText={setDescription} multiline maxLength={5000} editable={!command.busy} /><FormField label="Giới thiệu công khai" icon="compass" value={publicDescription} onChangeText={setPublicDescription} multiline maxLength={5000} editable={!command.busy} />
  </Screen>;
}
