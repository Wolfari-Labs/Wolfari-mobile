import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState, type ReactNode } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps, type ViewInstance } from "react-native";

import { colors, fonts, gradients, radii, shadows, typography } from "@/shared/theme/tokens";
import type { ClayIconName } from "./design-assets";
import { DateTimePickerDialog } from "./date-time-picker";
import { useKeyboardScroll } from "./keyboard-scroll";
import { groupMoney, moneyDigits } from "./money-input";
import { ClayIcon, claySubtitle } from "./setting-card";

const tones = { blue: colors.tealSoft, mint: colors.mint, butter: colors.butter, lilac: colors.lilac, peach: colors.peach } as const;
export type FieldTone = keyof typeof tones;
const fieldFill = "#F4F6FD";

function IconChip({ icon, tone }: { icon: ClayIconName; tone: FieldTone }) {
  return <View style={[styles.chipIcon, { backgroundColor: tones[tone] }]}><ClayIcon name={icon} size={18} /></View>;
}

/** Labelled text input (Figma D/Input). Focus changes colors only, so Android keeps the keyboard open. */
export function ClayField({ label, icon, tone = "blue", trailing, style, onFocus, onBlur, ...input }: TextInputProps & {
  label: string; icon: ClayIconName; tone?: FieldTone; trailing?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const fieldRef = useRef<ViewInstance | null>(null);
  const keyboardScroll = useKeyboardScroll();
  return <View ref={fieldRef} collapsable={false} style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View collapsable={false} style={[styles.box, input.multiline && styles.multilineBox, focused && styles.focused, input.editable === false && styles.disabled]}>
      <IconChip icon={icon} tone={tone} />
      <TextInput {...input} accessibilityLabel={label} placeholderTextColor={claySubtitle.color} selectionColor={colors.teal}
        style={[typography.body, styles.input, input.multiline && styles.multiline, style]}
        onFocus={event => { setFocused(true); keyboardScroll?.scrollToField(fieldRef.current); onFocus?.(event); }}
        onBlur={event => { setFocused(false); keyboardScroll?.scrollToField(null); onBlur?.(event); }}
        onContentSizeChange={event => { if (focused && input.multiline) keyboardScroll?.scrollToField(fieldRef.current); input.onContentSizeChange?.(event); }} />
      {trailing}
    </View>
  </View>;
}

/** Tap target that opens a picker owned by the caller. */
export function ClaySelect({ label, value, icon, tone, disabled = false, onPress }: {
  label: string; value: string; icon: ClayIconName; tone: FieldTone; disabled?: boolean; onPress?: () => void;
}) {
  const content = <>
    <IconChip icon={icon} tone={tone} />
    <Text style={[typography.body, styles.flex]} numberOfLines={1}>{value}</Text>
    {onPress && <ClayIcon name="chevronDown" size={18} />}
  </>;
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {onPress ? <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={`Đang chọn ${value}`} accessibilityState={{ disabled }} disabled={disabled}
      onPress={() => { Keyboard.dismiss(); onPress(); }} style={({ pressed }) => [styles.box, (pressed || disabled) && styles.disabled]}>{content}</Pressable>
      : <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.box}>{content}</View>}
  </View>;
}

/** Date picker field; the browser also accepts typing and pasting DD/MM/YYYY. */
export function ClayDateField({ label, value, minimum, mode = "date", editable = true, onChangeText }: {
  label: string; value: string; mode?: "date" | "time"; minimum?: string; editable?: boolean; onChangeText: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const show = () => { Keyboard.dismiss(); setOpen(true); };
  const icon = mode === "date" ? "fieldCalendar" : "fieldClock";
  const tone = mode === "date" ? "butter" : "lilac";
  const web = Platform.OS === "web";
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {web ? <View style={[styles.box, !editable && styles.disabled]}>
      <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={`Mở bộ chọn ${label.toLowerCase()}`} disabled={!editable} hitSlop={6} onPress={show}><IconChip icon={icon} tone={tone} /></Pressable>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={editable} placeholder={mode === "date" ? "DD/MM/YYYY" : "HH:mm"} maxLength={mode === "date" ? 10 : 5}
        placeholderTextColor={claySubtitle.color} style={[typography.body, styles.input]} />
    </View> : <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: value || "Chưa chọn" }} accessibilityHint={mode === "date" ? "Mở bộ chọn ngày" : "Mở bộ chọn giờ"}
      accessibilityState={{ disabled: !editable }} disabled={!editable} onPress={show} style={({ pressed }) => [styles.box, (pressed || !editable) && styles.disabled]}>
      <IconChip icon={icon} tone={tone} />
      <Text style={[typography.body, styles.flex, !value && { color: claySubtitle.color }]} numberOfLines={1}>{value || (mode === "date" ? "Chọn ngày" : "Chọn giờ")}</Text>
    </Pressable>}
    <DateTimePickerDialog visible={open} title={label} mode={mode} value={value} minimum={minimum} onConfirm={onChangeText} onClose={() => setOpen(false)} />
  </View>;
}

/** Large VND amount typed with the digits-only keyboard; anything else is dropped. Reports raw digits. */
export function ClayAmount({ label, value, onChangeText, maxDigits = 12, size = 28, center = false, editable = true, autoFocus }: {
  label: string; value: string; onChangeText: (digits: string) => void; maxDigits?: number; size?: 28 | 36; center?: boolean; editable?: boolean; autoFocus?: boolean;
}) {
  const ref = useRef<ViewInstance | null>(null);
  const inputRef = useRef<TextInputInstance | null>(null);
  const keyboardScroll = useKeyboardScroll();
  const [focused, setFocused] = useState(false);
  const [overLimit, setOverLimit] = useState(false);
  // Long amounts shrink to stay on one line.
  const shown = groupMoney(value);
  const fontSize = shown.length > 15 ? size * 0.6 : shown.length > 11 ? size * 0.78 : size;
  const type = { fontFamily: fonts.heading, fontSize, color: colors.ink, fontVariant: ["tabular-nums" as const] };
  function change(text: string) {
    const digits = moneyDigits(text, text.length).replace(/^0+(?=\d)/, "");
    setOverLimit(digits.length > maxDigits);
    if (digits.length <= maxDigits) onChangeText(digits);
  }
  return <View><Pressable ref={ref} cssInterop={false} accessible={false} tabIndex={-1} disabled={!editable} onPress={() => inputRef.current?.focus()}
    style={[styles.amount, !center && styles.amountLine, !center && focused && styles.amountLineFocused, center && { justifyContent: "center" }, !editable && styles.disabled]}>
    <View style={styles.numberBox}>
      <Text accessible={false} aria-hidden numberOfLines={1} style={[type, styles.numberMeasure]}>{shown || "0"}</Text>
      <TextInput ref={inputRef} accessibilityLabel={label} value={shown}
        onChangeText={change}
        editable={editable} autoFocus={autoFocus} keyboardType="number-pad" inputMode="numeric" autoCapitalize="none" autoCorrect={false} autoComplete="off"
        returnKeyType="done" placeholder="0" placeholderTextColor={claySubtitle.color} selectionColor={colors.teal}
        onFocus={() => { setFocused(true); keyboardScroll?.scrollToField(ref.current); }}
        onBlur={() => { setFocused(false); keyboardScroll?.scrollToField(null); }}
        style={[StyleSheet.absoluteFill, type, styles.amountInput, center && { textAlign: "center" }]} />
    </View>
    <Text style={type}>₫</Text>
  </Pressable>
    {overLimit && <Text accessibilityRole="alert" style={[claySubtitle, { color: colors.error }]}>Chỉ nhận số tiền tối đa {maxDigits} chữ số.</Text>}
  </View>;
}

/** Filter/choice pill; gradient when selected. */
export function ClayChip({ label, accessibilityLabel, selected, role = "radio", disabled = false, onPress }: {
  label: string; accessibilityLabel?: string; selected: boolean; role?: "radio" | "tab"; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable cssInterop={false} accessibilityRole={role} accessibilityLabel={accessibilityLabel ?? label} accessibilityState={role === "tab" ? { selected, disabled } : { checked: selected, disabled }}
    aria-checked={role === "radio" ? selected : undefined} aria-selected={role === "tab" ? selected : undefined} disabled={disabled} hitSlop={4} onPress={onPress}
    style={({ pressed }) => [styles.chip, pressed && { opacity: 0.75 }]}>
    {selected && <LinearGradient pointerEvents="none" colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: radii.pill }]} />}
    <Text style={[styles.chipText, selected && { color: colors.surface }]}>{label}</Text>
  </Pressable>;
}

const avatarTones = ["#5B8CFF", "#3CC9B0", "#FFB547", "#FF8A7A"];
export function ClayAvatar({ name, index, overlap = false }: { name: string; index: number; overlap?: boolean }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.avatar, { backgroundColor: avatarTones[Math.max(0, index) % avatarTones.length] }, overlap && { marginLeft: -9 }]}>
    <Text style={styles.avatarText}>{name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase() ?? "?"}</Text>
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.ink },
  box: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 12, paddingRight: 16, borderRadius: 20, borderWidth: 2, borderColor: "transparent", backgroundColor: fieldFill },
  multilineBox: { alignItems: "flex-start", paddingTop: 10 },
  focused: { borderColor: colors.blue, backgroundColor: colors.surface },
  disabled: { opacity: 0.55 },
  chipIcon: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingVertical: 8, paddingHorizontal: 0, includeFontPadding: false, outlineWidth: 0 },
  multiline: { minHeight: 72, paddingTop: 4, textAlignVertical: "top" },
  flex: { flex: 1, minWidth: 0 },
  amount: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48 },
  amountLine: { borderBottomWidth: 2, borderBottomColor: colors.line },
  amountLineFocused: { borderBottomColor: colors.blue },
  numberBox: { maxWidth: "86%", minHeight: 48, justifyContent: "center" },
  numberMeasure: { opacity: 0, paddingHorizontal: 2, includeFontPadding: false },
  amountInput: { width: "100%", paddingVertical: 0, paddingHorizontal: 1, includeFontPadding: false, outlineWidth: 0 },
  chip: { minHeight: 36, paddingHorizontal: 16, paddingVertical: 9, justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.surface, ...shadows.glass },
  chipText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: claySubtitle.color },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: colors.surface },
});
