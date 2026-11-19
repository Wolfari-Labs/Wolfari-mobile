import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Feedback } from "@/shared/ui/feedback";
import { Segments } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { scheduleDay, UNSCHEDULED, type ScheduleDraft } from "../model/schedule-draft";
import type { Activity, Trip } from "../types";
import { localTimestamp, timeLabel, tripDays } from "../utils";

const HOUR = 3_600_000;
const shortDay = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`;

function shiftTime(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = (((hours * 60 + mins + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Day + time for one activity, staged in the itinerary editor and saved with the order. */
export function ActivityScheduleSheet({
  activity,
  trip,
  onApply,
  onClose,
}: {
  activity: Activity;
  trip: Trip;
  onApply: (draft: ScheduleDraft) => string | undefined;
  onClose: () => void;
}) {
  const days = tripDays(trip);
  const duration =
    activity.starts_at && activity.ends_at
      ? Date.parse(activity.ends_at) - Date.parse(activity.starts_at)
      : HOUR;
  const [day, setDay] = useState(scheduleDay(activity, trip.timezone));
  const [mode, setMode] = useState<"timed" | "day">(activity.starts_at ? "timed" : "day");
  const [start, setStart] = useState(activity.starts_at ? timeLabel(activity.starts_at, trip.timezone) : "08:00");
  const [end, setEnd] = useState(
    activity.ends_at ? timeLabel(activity.ends_at, trip.timezone) : shiftTime("08:00", 60),
  );
  // Until the end is edited, keep the original length (also for overnight activities).
  const [endTouched, setEndTouched] = useState(false);
  const [error, setError] = useState<string>();

  function apply() {
    let draft: ScheduleDraft;
    if (day === UNSCHEDULED) draft = { kind: "unscheduled" };
    else if (mode === "day") draft = { kind: "day", date: day };
    else {
      const startsAt = localTimestamp(day, start, trip.timezone);
      const endsAt = endTouched
        ? localTimestamp(day, end, trip.timezone)
        : startsAt && new Date(Date.parse(startsAt) + Math.max(duration, 60_000)).toISOString();
      if (!startsAt || !endsAt) return setError("Chọn giờ hợp lệ theo dạng HH:mm.");
      if (Date.parse(endsAt) <= Date.parse(startsAt))
        return setError("Giờ kết thúc phải sau giờ bắt đầu. Hoạt động qua đêm hãy sửa trong form hoạt động.");
      if (Date.parse(startsAt) < Date.parse(trip.start_at) || Date.parse(endsAt) > Date.parse(trip.end_at))
        return setError("Thời gian cần nằm trong lịch của chuyến đi.");
      draft = { kind: "timed", starts_at: startsAt, ends_at: endsAt };
    }
    const problem = onApply(draft);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Sheet visible title={`Lịch · ${activity.title}`} onClose={onClose}>
      <Text style={styles.label}>Ngày</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[...days, UNSCHEDULED].map((value, index) => {
          const selected = value === day;
          const label = value === UNSCHEDULED ? "Chưa xếp lịch" : `Ngày ${index + 1}, ${shortDay(value)}`;
          return (
            <Pressable
              key={value}
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel={`Chuyển sang ${label}`}
              accessibilityState={{ selected }}
              onPress={() => {
                setDay(value);
                setError(undefined);
              }}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.7 }]}
            >
              {value === UNSCHEDULED ? (
                <Text style={[styles.chipTitle, selected && styles.chipSelectedText]}>Chưa xếp</Text>
              ) : (
                <>
                  <Text style={[styles.chipTitle, selected && styles.chipSelectedText]}>Ngày {index + 1}</Text>
                  <Text style={[styles.chipSub, selected && styles.chipSelectedText]}>{shortDay(value)}</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {day === UNSCHEDULED ? (
        <Text style={typography.footnote}>Hoạt động sẽ nằm trong mục Chưa xếp lịch, chưa gắn ngày và giờ.</Text>
      ) : (
        <>
          <Segments
            items={[
              { value: "timed", label: "Có giờ" },
              { value: "day", label: "Cả ngày" },
            ]}
            value={mode}
            onChange={(value) => {
              setMode(value as "timed" | "day");
              setError(undefined);
            }}
          />
          {mode === "timed" ? (
            <View style={styles.row}>
              <View style={styles.flex}>
                <DateTimeField
                  label="Bắt đầu"
                  mode="time"
                  value={start}
                  onChangeText={(value) => {
                    setStart(value);
                    setError(undefined);
                    if (!endTouched && /^\d{2}:\d{2}$/.test(value))
                      setEnd(shiftTime(value, Math.round(Math.max(duration, 60_000) / 60_000)));
                  }}
                />
              </View>
              <View style={styles.flex}>
                <DateTimeField
                  label="Kết thúc"
                  mode="time"
                  value={end}
                  onChangeText={(value) => {
                    setEnd(value);
                    setEndTouched(true);
                    setError(undefined);
                  }}
                />
              </View>
            </View>
          ) : (
            <Text style={typography.footnote}>Diễn ra trong ngày {shortDay(day)}, chưa chốt giờ.</Text>
          )}
        </>
      )}
      <Text style={typography.footnote}>Thay đổi chỉ được lưu khi bạn bấm “Lưu thứ tự cho nhóm”. Giờ theo {trip.timezone}.</Text>
      {error && <Feedback message={error} />}
      <Button label="Áp dụng" onPress={apply} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.bold },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    minWidth: 64,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.control,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: colors.teal },
  chipTitle: { color: colors.ink, fontSize: 14, fontFamily: fonts.bold },
  chipSub: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  chipSelectedText: { color: "white" },
  row: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
});
