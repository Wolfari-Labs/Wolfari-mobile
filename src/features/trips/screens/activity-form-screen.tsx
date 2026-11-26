import { DesignPopup } from "@/shared/ui/design-popup";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { colors, fonts, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { ClayChip, ClayDateField, ClayField, ClaySelect } from "@/shared/ui/clay-form";
import { designAssets } from "@/shared/ui/design-assets";
import { Details } from "@/shared/ui/details";
import { ClayButton } from "@/shared/ui/setting-card";
import {
  EmptyState,
  ResourceFeedback,
  Segments,
  ui,
} from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import type { Activity } from "../types";
import {
  activitySchedule,
  calendarLabel,
  dateKey,
  dateLabel,
  isTripDay,
  tripDays,
  localTimestamp,
  parseDate,
  timeLabel,
  type ActivitySchedule,
} from "../utils";

const transportModes = ["Đi bộ", "Xe đạp", "Xe máy", "Ô tô", "Phương tiện công cộng"];
const transportLine = /^Di chuyển: (Đi bộ|Xe đạp|Xe máy|Ô tô|Phương tiện công cộng)(?: · (\d{1,3}) phút)?(?:\n|$)/;

export default function ActivityFormScreen() {
  const resource = useTrip();
  const [edition, setEdition] = useState(0);
  const { activityId } = useLocalSearchParams<{ activityId?: string }>();
  if (!resource.data)
    return (
      <Screen title="Hoạt động">
        <ResourceFeedback
          {...resource}
          hasData={false}
          onRetry={() => {
            void resource.reload();
          }}
        />
      </Screen>
    );
  const activity = resource.data.plan.activities.find(
    (item) => item.id === activityId,
  );
  if (activityId && !activity)
    return (
      <Screen title="Hoạt động">
        <EmptyState
          title="Hoạt động không còn trong lịch"
          scene="notFound"
          message="Có thể một thành viên đã gỡ hoạt động này. Hãy quay lại lịch trình mới nhất."
        />
      </Screen>
    );
  if (!resource.data.plan.permissions.can_edit)
    return (
      <Screen title="Hoạt động">
        <EmptyState
          title="Kế hoạch của nhóm"
          message="Bạn chưa có quyền chỉnh sửa lịch trình này."
        />
      </Screen>
    );
  return (
    <ActivityForm
      key={`${activityId ?? "new"}:${edition}`}
      onUseLatest={() => setEdition(value => value + 1)}
      resource={resource}
      activity={activity}
    />
  );
}
function ActivityForm({
  resource,
  activity,
  onUseLatest,
}: {
  resource: ReturnType<typeof useTrip>;
  activity?: Activity;
  onUseLatest(): void;
}) {
  const { data, api, id } = resource;
  const { trip, plan } = data!;
  const [baseVersion] = useState(plan.plan_version);
  const [savedId, setSavedId] = useState<string>();
  const [replaceDraft, setReplaceDraft] = useState(false);
  const stale = baseVersion !== plan.plan_version;
  const {
    day,
    title: initialTitle,
    note,
    locationId,
    activityType,
    duration,
  } = useLocalSearchParams<{
    day?: string;
    title?: string;
    note?: string;
    locationId?: string;
    /** From a map place: suggested type and visit length in minutes. */
    activityType?: string;
    duration?: string;
  }>();
  const visitMinutes = Number(duration);
  const command = useCommand();
  const [publicDescription, setPublicDescription] = useState(activity?.public_description ?? "");
  const [selectedLocation, setSelectedLocation] = useState(activity?.selected_location_id ?? plan.selected_locations.find(location => location.id === locationId)?.id ?? "");
  const [title, setTitle] = useState(activity?.title ?? initialTitle ?? "");
  const initialNote = activity?.description ?? note ?? "";
  const transport = initialNote.match(transportLine);
  const [description, setDescription] = useState(initialNote.slice(transport?.[0].length ?? 0));
  const [vehicle, setVehicle] = useState(transport?.[1] ?? "");
  const [minutes, setMinutes] = useState(transport?.[2] ?? "");
  const [showTravel, setShowTravel] = useState(false);
  const [overnight, setOvernight] = useState(!!activity?.starts_at && !!activity.ends_at && dateKey(activity.starts_at, trip.timezone) !== dateKey(activity.ends_at, trip.timezone));
  const [type, setType] = useState(activity?.activity_type ?? (activityType && /^[A-Z_]{1,40}$/.test(activityType) ? activityType : "SIGHTSEEING"));
  const [mode, setMode] = useState<ActivitySchedule>(
    activity ? activitySchedule(activity) : day === "unscheduled" ? "unscheduled" : "timed",
  );
  const initialDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? calendarLabel(day) : dateLabel(trip.start_at, trip.timezone);
  const [date, setDate] = useState(
    activity?.scheduled_date
      ? calendarLabel(activity.scheduled_date)
      : activity?.starts_at ? dateLabel(activity.starts_at, trip.timezone) : initialDay,
  );
  const [start, setStart] = useState(
    activity?.starts_at
      ? timeLabel(activity.starts_at, trip.timezone)
      : "08:00",
  );
  const [end, setEnd] = useState(
    activity?.ends_at
      ? timeLabel(activity.ends_at, trip.timezone)
      : Number.isInteger(visitMinutes) && visitMinutes > 0 && visitMinutes < 16 * 60
        ? `${String(8 + Math.floor(visitMinutes / 60)).padStart(2, "0")}:${String(visitMinutes % 60).padStart(2, "0")}`
        : "09:00",
  );
  const [endDate, setEndDate] = useState(
    activity?.ends_at ? dateLabel(activity.ends_at, trip.timezone) : initialDay,
  );
  const [validation, setValidation] = useState<string>();
  const tripFirstDay = calendarLabel(dateKey(trip.start_at, trip.timezone));
  async function submit() {
    if (stale || resource.loading || resource.error || command.busy) return;
    if (!title.trim() || title.trim().length > 255) {
      setValidation("Tên hoạt động cần từ 1 đến 255 ký tự.");
      return;
    }
    const first = parseDate(date),
      last = overnight ? parseDate(endDate) : first;
    const timed = mode === "timed";
    if (mode === "day" && (!first || !isTripDay(first, trip))) {
      setValidation("Chọn một ngày nằm trong thời gian của chuyến đi.");
      return;
    }
    const starts_at =
      timed && first ? localTimestamp(first, start, trip.timezone) : null;
    const ends_at =
      timed && last ? localTimestamp(last, end, trip.timezone) : null;
    if (timed && (!starts_at || !ends_at || ends_at <= starts_at)) {
      setValidation(
        "Nhập ngày và giờ hợp lệ. Giờ kết thúc phải sau giờ bắt đầu.",
      );
      return;
    }
    if (
      starts_at &&
      ends_at &&
      (starts_at < trip.start_at || ends_at > trip.end_at)
    ) {
      setValidation("Hoạt động cần nằm trong thời gian của chuyến đi.");
      return;
    }
    setValidation(undefined);
    const input = {
      title: title.trim(),
      description: [vehicle && `Di chuyển: ${vehicle}${Number(minutes) ? ` · ${Number(minutes)} phút` : ""}`, description.trim()].filter(Boolean).join("\n") || null,
      public_description: publicDescription.trim() || null,
      activity_type: type,
      starts_at: starts_at ?? null,
      ends_at: ends_at ?? null,
      // Timed writes omit the date: the server clears it with the timestamp pair.
      // Day-only sends both timestamps null; unscheduled clears the date explicitly.
      ...(timed ? {} : { scheduled_date: mode === "day" ? first! : null }),
      selected_location_id: selectedLocation || null,
      position: activity?.position ?? plan.activities.length,
      expected_plan_version: baseVersion,
    };
    if ((input.description?.length ?? 0) > 5000) { setValidation("Ghi chú và thông tin di chuyển tối đa 5.000 ký tự."); return; }
    const result = await command.run(
      { activityId: activity?.id, ...input },
      (key) => api.trips.saveActivity(id, activity?.id, input, key),
    );
    if (result) setSavedId(result.id);
  }
  const dayNumber = tripDays(trip).indexOf(parseDate(date) ?? "") + 1;
  const cancel = () => { if (router.canGoBack()) router.back(); else router.replace({ pathname: "/trip/[id]/itinerary", params: { id } }); };
  return (
    <Screen clay
      title={activity ? "Chỉnh sửa hoạt động" : "Thêm hoạt động"}
      bottomPadding={24}
      footer={<View style={ui.row}>
        <View style={{ width: "34%", maxWidth: 120 }}><ClayButton label="Hủy" tone="secondary" onPress={cancel} disabled={command.busy} /></View>
        <View style={ui.flex}><ClayButton label={activity ? "Lưu thay đổi" : "Thêm vào lịch trình"} loading={command.busy}
          disabled={stale || resource.loading || !!resource.error} onPress={() => { void submit(); }} /></View>
      </View>}
    >
      {savedId && <DesignPopup kind="activity" message="Tiếp tục sắp xếp các hoạt động để cả nhóm có một lịch trình phù hợp."
        onPrimary={() => router.dismissTo({ pathname: "/trip/[id]/itinerary", params: { id } })}
        onClose={() => { setSavedId(undefined); if (activity?.id !== savedId) router.replace({ pathname: "/trip/[id]/activity", params: { id, activityId: savedId } }); else void resource.reload().then(latest => { if (latest) onUseLatest(); }); }} />}
      <View style={styles.intro}><Text accessibilityRole="header" style={styles.title}>{activity ? "Sửa trải nghiệm" : "Thêm một trải nghiệm"}</Text>
        <Text style={typography.footnote}>{trip.name}{dayNumber && mode !== "unscheduled" ? ` · Ngày ${dayNumber}` : ""}</Text></View>
      {stale && <>
        <Feedback inline message="Kế hoạch đã thay đổi. Bản bạn đang sửa được giữ để đối chiếu và chưa thể lưu. Dùng bản mới của nhóm rồi chỉnh sửa lại để tránh ghi đè." />
        <Button label="Dùng bản mới của nhóm" variant="soft" disabled={resource.loading || !!resource.error} onPress={() => setReplaceDraft(true)} />
      </>}
      {resource.error && <Feedback message={resource.error} />}
      <Sheet visible={replaceDraft} title="Thay bản đang chỉnh sửa?" onClose={() => setReplaceDraft(false)}>
        <Text style={typography.body}>Các thay đổi chưa lưu trong biểu mẫu này sẽ được thay bằng nội dung mới nhất vừa tải từ nhóm.</Text>
        <Button label="Dùng bản mới và chỉnh sửa lại" disabled={resource.loading || !!resource.error} onPress={onUseLatest} />
      </Sheet>
      {validation && <Feedback message={validation} />}
      {command.error && (
        <>
          <Feedback message={command.error} />
          <Button
            label="Tải kế hoạch mới nhất"
            variant="soft"
            compact
            onPress={() => {
              void resource.reload();
            }}
          />
        </>
      )}
      <ClayField label="Địa điểm / hoạt động" icon="fieldSearch" value={title} onChangeText={setTitle} maxLength={255} placeholder="Bạn muốn đến đâu?" editable={!command.busy} />
      {mode !== "unscheduled" && <ClayDateField label="Ngày" value={date} minimum={tripFirstDay} onChangeText={setDate} editable={!command.busy} />}
      {mode === "timed" && <View style={ui.row}>
        <View style={ui.flex}><ClayDateField label="Bắt đầu" mode="time" value={start} onChangeText={setStart} editable={!command.busy} /></View>
        <View style={ui.flex}><ClayDateField label="Kết thúc" mode="time" value={end} onChangeText={setEnd} editable={!command.busy} /></View>
      </View>}
      <ClaySelect label="Di chuyển" icon="fieldCar" tone="mint" value={vehicle ? vehicle + (Number(minutes) ? ` · Khoảng ${Number(minutes)} phút` : "") : "Chọn phương tiện"} disabled={command.busy} onPress={() => setShowTravel(true)} />
      <ClayField label="Ghi chú" icon="fieldNote" tone="peach" value={description} onChangeText={setDescription} placeholder="Kế hoạch cho cả nhóm" multiline maxLength={5000} editable={!command.busy} />
      <View style={styles.tip}><Image source={designAssets.activityWolf} style={styles.wolf} contentFit="contain" accessible={false} />
        <Text style={styles.tipText}>Dành thời gian di chuyển giữa các điểm dừng trong ngày.</Text></View>
      <Text style={typography.footnote}>Thời gian trong lịch trình</Text>
      <Segments items={[{ value: "unscheduled", label: "Chưa xếp lịch" }, { value: "day", label: "Chưa định giờ" }, { value: "timed", label: "Có giờ" }]}
        value={mode} onChange={value => { if (!command.busy) setMode(value as ActivitySchedule); }} />
      <Details title="Tùy chọn hoạt động" defaultOpen={overnight}>
        {mode === "timed" && <><Button variant="soft" compact label={overnight ? "Kết thúc cùng ngày" : "Kết thúc vào ngày khác"} disabled={command.busy} onPress={() => { if (!overnight) setEndDate(date); setOvernight(!overnight); }} />
          {overnight && <ClayDateField label="Ngày kết thúc" value={endDate} minimum={date} onChangeText={setEndDate} editable={!command.busy} />}</>}
        <Text style={typography.footnote}>Loại hoạt động</Text>
        <Segments scroll items={[{ value: "SIGHTSEEING", label: "Tham quan" }, { value: "MEAL", label: "Ăn uống" }, { value: "TRANSPORT", label: "Di chuyển" }, { value: "OTHER", label: "Khác" },
          ...(!["SIGHTSEEING","MEAL","TRANSPORT","OTHER"].includes(type) ? [{ value: type, label: "Loại hoạt động khác" }] : [])]} value={type} onChange={value => { if (!command.busy) setType(value); }} />
        <ClayField label="Giới thiệu công khai của hoạt động" icon="fieldEdit" value={publicDescription} onChangeText={setPublicDescription} multiline maxLength={5000} editable={!command.busy} />
        {plan.selected_locations.length > 0 && <><Text style={typography.footnote}>Gắn với địa điểm của nhóm</Text>
          <Segments scroll items={[{ value: "", label: "Không gắn địa điểm" }, ...plan.selected_locations.map(p => ({ value: p.id, label: p.name }))]} value={selectedLocation} onChange={value => { if (!command.busy) setSelectedLocation(value); }} /></>}
      </Details>
      <Sheet visible={showTravel} title="Di chuyển" onClose={() => setShowTravel(false)}>
        <View style={styles.choices}>{["", ...transportModes].map(item => <ClayChip key={item} label={item || "Chưa chọn"} selected={vehicle === item} onPress={() => setVehicle(item)} />)}</View>
        {!!vehicle && <ClayField label="Thời gian dự kiến (phút)" icon="fieldClock" tone="lilac" inputMode="numeric" keyboardType="number-pad" value={minutes} maxLength={3} onChangeText={v => setMinutes(v.replace(/\D/g, ""))} placeholder="Không bắt buộc" />}
        <ClayButton label="Xong" onPress={() => setShowTravel(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 4 }, title: { ...typography.title, fontSize: 25, lineHeight: 32 },
  tip: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 22, backgroundColor: colors.butter },
  wolf: { width: 46, height: 52 }, tipText: { ...typography.footnote, fontFamily: fonts.bold, color: colors.ink, flex: 1 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
