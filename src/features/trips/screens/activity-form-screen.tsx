import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { DateTimeField } from "@/shared/ui/date-time-field";
import {
  EmptyState,
  Heading,
  ResourceFeedback,
  Segments,
  ui,
} from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import type { Activity } from "../types";
import {
  dateKey,
  dateLabel,
  localTimestamp,
  parseDate,
  timeLabel,
} from "../utils";

export default function ActivityFormScreen() {
  const resource = useTrip();
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
      key={activityId ?? "new"}
      resource={resource}
      activity={activity}
    />
  );
}
function ActivityForm({
  resource,
  activity,
}: {
  resource: ReturnType<typeof useTrip>;
  activity?: Activity;
}) {
  const { data, api, id } = resource;
  const { trip, plan } = data!;
  const {
    day,
    title: initialTitle,
    note,
    locationId,
  } = useLocalSearchParams<{
    day?: string;
    title?: string;
    note?: string;
    locationId?: string;
  }>();
  const command = useCommand();
  const [title, setTitle] = useState(activity?.title ?? initialTitle ?? "");
  const [description, setDescription] = useState(
    activity?.description ?? note ?? "",
  );
  const [type, setType] = useState(activity?.activity_type ?? "SIGHTSEEING");
  const [scheduled, setScheduled] = useState(
    activity ? !!activity.starts_at : day !== "unscheduled",
  );
  const initialDay =
    day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T12:00:00Z` : trip.start_at;
  const [date, setDate] = useState(
    dateLabel(activity?.starts_at ?? initialDay, trip.timezone),
  );
  const [start, setStart] = useState(
    activity?.starts_at
      ? timeLabel(activity.starts_at, trip.timezone)
      : "08:00",
  );
  const [end, setEnd] = useState(
    activity?.ends_at ? timeLabel(activity.ends_at, trip.timezone) : "09:00",
  );
  const [endDate, setEndDate] = useState(
    dateLabel(activity?.ends_at ?? initialDay, trip.timezone),
  );
  const [validation, setValidation] = useState<string>();
  async function submit() {
    if (!title.trim() || title.trim().length > 255) {
      setValidation("Tên hoạt động cần từ 1 đến 255 ký tự.");
      return;
    }
    const first = parseDate(date),
      last = parseDate(endDate);
    const starts_at =
      scheduled && first ? localTimestamp(first, start, trip.timezone) : null;
    const ends_at =
      scheduled && last ? localTimestamp(last, end, trip.timezone) : null;
    if (scheduled && (!starts_at || !ends_at || ends_at <= starts_at)) {
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
    const selectedLocation =
      activity?.selected_location_id ??
      plan.selected_locations.find((location) => location.id === locationId)
        ?.id;
    const input = {
      title: title.trim(),
      description: description.trim() || null,
      activity_type: type,
      starts_at: starts_at ?? null,
      ends_at: ends_at ?? null,
      ...(selectedLocation ? { selected_location_id: selectedLocation } : {}),
      position: activity?.position ?? plan.activities.length,
      expected_plan_version: plan.plan_version,
    };
    const result = await command.run(
      { activityId: activity?.id, ...input },
      (key) => api.trips.saveActivity(id, activity?.id, input, key),
    );
    if (result)
      router.replace({ pathname: "/trip/[id]/itinerary", params: { id } });
  }
  return (
    <Screen
      title={activity ? "Chỉnh sửa hoạt động" : "Thêm hoạt động"}
      bottomPadding={24}
      footer={
        <Button
          label={activity ? "Lưu thay đổi" : "Thêm vào lịch trình"}
          loading={command.busy}
          onPress={() => {
            void submit();
          }}
        />
      }
    >
      <Heading title="Thêm một trải nghiệm" subtitle={trip.name} />
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
      <FormField
        label="Địa điểm / hoạt động"
        icon="pin"
        value={title}
        onChangeText={setTitle}
        maxLength={255}
        placeholder="Bạn muốn trải nghiệm điều gì?"
        editable={!command.busy}
      />
      <Segments
        scroll
        items={[
          { value: "SIGHTSEEING", label: "Tham quan" },
          { value: "MEAL", label: "Ăn uống" },
          { value: "TRANSPORT", label: "Di chuyển" },
          { value: "OTHER", label: "Khác" },
          ...(!["SIGHTSEEING", "MEAL", "TRANSPORT", "OTHER"].includes(type)
            ? [{ value: type, label: type }]
            : []),
        ]}
        value={type}
        onChange={setType}
      />
      <View style={ui.row}>
        <Text style={[typography.body, ui.flex]}>Xếp vào lịch trình</Text>
        <Switch
          accessibilityLabel="Xếp vào lịch trình"
          value={scheduled}
          onValueChange={setScheduled}
          trackColor={{ true: colors.teal, false: colors.line }}
          disabled={command.busy}
        />
      </View>
      {scheduled && (
        <>
          <DateTimeField
            label="Ngày bắt đầu"
            value={date}
            onChangeText={setDate}
            editable={!command.busy}
          />
          <View style={ui.row}>
            <View style={ui.flex}>
              <DateTimeField
                label="Bắt đầu"
                mode="time"
                value={start}
                onChangeText={setStart}
                editable={!command.busy}
              />
            </View>
            <View style={ui.flex}>
              <DateTimeField
                label="Kết thúc"
                mode="time"
                value={end}
                onChangeText={setEnd}
                editable={!command.busy}
              />
            </View>
          </View>
          <DateTimeField
            label="Ngày kết thúc"
            value={endDate}
            onChangeText={setEndDate}
            editable={!command.busy}
          />
          <Text style={typography.footnote}>
            Múi giờ {trip.timezone} · {dateKey(trip.start_at, trip.timezone)} –{" "}
            {dateKey(trip.end_at, trip.timezone)}
          </Text>
        </>
      )}
      <FormField
        label="Ghi chú"
        icon="edit"
        value={description}
        onChangeText={setDescription}
        placeholder="Kế hoạch nhỏ cho cả nhóm…"
        multiline
        maxLength={5000}
        editable={!command.busy}
      />
    </Screen>
  );
}
