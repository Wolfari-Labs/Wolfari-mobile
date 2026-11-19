import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, typography } from "@/shared/theme/tokens";
import { Button } from "./button";
import type { DateTimePickerDialogProps } from "./date-time-picker.types";
import {
  minimumPickerDate,
  monthCells,
  pickerText,
  pickerValue,
} from "./date-time-values";
import { Sheet } from "./sheet";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const pad = (value: number) => String(value).padStart(2, "0");

export function DateTimePickerDialog(props: DateTimePickerDialogProps) {
  return (
    <Sheet visible={props.visible} title={props.title} onClose={props.onClose}>
      {props.visible &&
        (props.mode === "date" ? (
          <CalendarPicker {...props} />
        ) : (
          <TimePicker {...props} />
        ))}
    </Sheet>
  );
}

function CalendarPicker({ value, minimum, onConfirm, onClose }: DateTimePickerDialogProps) {
  const selected = pickerValue(value, "date");
  const [month, setMonth] = useState({
    year: selected.getUTCFullYear(),
    month: selected.getUTCMonth(),
  });
  const floor = minimumPickerDate(minimum);
  const today = pickerValue("", "date");
  const shift = (step: number) =>
    setMonth(({ year, month: current }) => {
      const next = new Date(Date.UTC(year, current + step, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  const choose = (date: Date) => {
    onConfirm(pickerText(date, "date"));
    onClose();
  };
  return (
    <>
      <View style={styles.monthBar}>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Tháng trước"
          onPress={() => shift(-1)}
          style={({ pressed }) => [styles.nav, pressed && styles.pressed]}
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[typography.headline, styles.monthTitle]}>
          Tháng {month.month + 1}, {month.year}
        </Text>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Tháng sau"
          onPress={() => shift(1)}
          style={({ pressed }) => [styles.nav, pressed && styles.pressed]}
        >
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={[styles.cell, styles.weekday]}>
            {day}
          </Text>
        ))}
        {monthCells(month.year, month.month).map((day, index) => {
          if (!day) return <View key={`pad-${index}`} style={styles.cell} />;
          const date = new Date(Date.UTC(month.year, month.month, day, 12));
          const label = pickerText(date, "date");
          const disabled = !!floor && date < floor;
          const active = label === pickerText(selected, "date") && !!value;
          const isToday = label === pickerText(today, "date");
          return (
            <Pressable
              key={label}
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled, selected: active }}
              disabled={disabled}
              onPress={() => choose(date)}
              style={({ pressed }) => [
                styles.cell,
                styles.day,
                isToday && styles.today,
                active && styles.selected,
                pressed && styles.pressed,
                disabled && styles.disabled,
              ]}
            >
              <Text style={[styles.dayText, active && styles.selectedText]}>{day}</Text>
            </Pressable>
          );
        })}
      </View>
      {(!floor || today >= floor) && (
        <Button label="Hôm nay" variant="soft" compact onPress={() => choose(today)} />
      )}
    </>
  );
}

function TimePicker({ value, onConfirm, onClose }: DateTimePickerDialogProps) {
  const initial = pickerValue(value, "time");
  const [hour, setHour] = useState(initial.getUTCHours());
  const [minute, setMinute] = useState(initial.getUTCMinutes());
  const minutes = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), minute])].sort(
    (a, b) => a - b,
  );
  return (
    <>
      <Text style={[typography.title, { textAlign: "center" }]}>
        {pad(hour)}:{pad(minute)}
      </Text>
      <Text style={styles.section}>Giờ</Text>
      <View style={styles.chips}>
        {HOURS.map((item) => (
          <Chip key={item} label={pad(item)} accessibilityLabel={`${pad(item)} giờ`} active={item === hour} onPress={() => setHour(item)} />
        ))}
      </View>
      <Text style={styles.section}>Phút</Text>
      <View style={styles.chips}>
        {minutes.map((item) => (
          <Chip key={item} label={pad(item)} accessibilityLabel={`${pad(item)} phút`} active={item === minute} onPress={() => setMinute(item)} />
        ))}
      </View>
      <Button
        label="Xong"
        onPress={() => {
          onConfirm(`${pad(hour)}:${pad(minute)}`);
          onClose();
        }}
      />
    </>
  );
}

function Chip({ label, accessibilityLabel, active, onPress }: {
  label: string;
  accessibilityLabel: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.selected, pressed && styles.pressed]}
    >
      <Text style={[styles.dayText, active && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthTitle: { flex: 1, textAlign: "center" },
  nav: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill,
  },
  navText: { color: colors.ink, fontSize: 24, lineHeight: 26, fontFamily: fonts.bold },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  weekday: { aspectRatio: undefined, height: 28, color: colors.muted, fontSize: 12, fontFamily: fonts.bold, textAlign: "center" },
  day: { borderRadius: radii.pill },
  today: { borderWidth: 1.5, borderColor: colors.teal },
  selected: { backgroundColor: colors.teal },
  selectedText: { color: "white" },
  dayText: { color: colors.ink, fontSize: 15, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.3 },
  section: { color: colors.muted, fontSize: 13, fontFamily: fonts.bold },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
});
