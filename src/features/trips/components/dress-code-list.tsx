import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { errorMessage } from '@/shared/api/errors';
import { DressReferenceImage } from './dress-reference-image';

import { useCommand } from "@/shared/hooks/use-command";
import { colors, fonts, pastelTones, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Snackbar } from "@/shared/ui/toast";
import { FormField } from "@/shared/ui/form-field";
import type { DesignIconName } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import { EmptyState, Notice, Segments, ui } from "@/shared/ui/journal";
import type { PastelTone } from "@/shared/ui/pastel";
import { Sheet } from "@/shared/ui/sheet";
import type { useTrip } from "../hooks/use-trip";
import { dressCodeForm, dressCodeInput, dressDayLabel, dressScopeLabel, dressScopes, DRESS_LABEL_MAX, type DressCodeForm } from "../model/dress-code";
import { dressPalette, dressRegion, dressSuggestionText, dressSuggestions, dressWeather, dressWeatherOptions, type DressColor, type DressSuggestion, type DressWeather } from "../model/dress-suggestions";
import type { DressCode, Plan, Trip } from "../types";
import { dateKey } from "../utils";

const sectionMeta: { scope: DressCode["scope_type"]; title: string; icon: DesignIconName; tone: PastelTone }[] = [
  { scope: "TRIP", title: "Cho cả chuyến", icon: "trip", tone: "mint" },
  { scope: "DAY", title: "Theo từng ngày", icon: "calendar", tone: "blue" },
  { scope: "ACTIVITY", title: "Theo hoạt động", icon: "pin", tone: "peach" },
];

type TripApi = ReturnType<typeof useTrip>["api"];
type Props = { api: TripApi; trip: Pick<Trip, "id" | "name" | "start_at" | "timezone">; plan: Plan; days: string[]; reload: () => Promise<unknown> | void };

/** Dress codes saved on the server and shared with the whole group (FR-PL03). */
export function DressCodeList({ api, trip, plan, days, reload }: Props) {
  const tripId = trip.id;
  const [scope, setScope] = useState("ALL");
  const command = useCommand();
  const [form, setForm] = useState<DressCodeForm>();
  const [formError, setFormError] = useState<string>();
  const [deleting, setDeleting] = useState<DressCode>();
  const [saved, setSaved] = useState<string>();
  const [pickedWeather, setPickedWeather] = useState<DressWeather>();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRef = useRef<ImagePicker.ImagePickerAsset | undefined>(undefined);
  const uploaded = useRef<{ uri: string; imageId: string } | undefined>(undefined);
  const photoLock = useRef(false), active = useRef(true);
  const busy = command.busy || photoBusy;
  function releasePhoto() {
    if (Platform.OS === 'web' && photoRef.current?.uri.startsWith('blob:')) URL.revokeObjectURL(photoRef.current.uri);
    photoRef.current = undefined; uploaded.current = undefined;
  }
  function closeForm() { releasePhoto(); setPhoto(undefined); setRemovePhoto(false); setForm(undefined); }
  useEffect(() => { active.current = true; return () => { active.current = false; releasePhoto(); }; }, []);
  async function choosePhoto() {
    if (photoLock.current || busy) return;
    photoLock.current = true; setPhotoBusy(true); setFormError(undefined);
    try {
      const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: false });
      if (selected.canceled || !active.current) return;
      const asset = selected.assets[0];
      if (!asset.mimeType || !['image/jpeg', 'image/png'].includes(asset.mimeType) || (asset.fileSize ?? asset.file?.size ?? 0) > 2 * 1024 * 1024 || asset.width * asset.height > 20_000_000) throw Error('Chọn ảnh JPG/PNG tối đa 2 MB và 20 triệu pixel.');
      releasePhoto(); photoRef.current = asset; setPhoto(asset); setRemovePhoto(false);
    } catch (error) { if (active.current) setFormError(errorMessage(error)); }
    finally { photoLock.current = false; if (active.current) setPhotoBusy(false); }
  }
  const editable = plan.permissions.can_edit;
  const visible = plan.dress_codes.filter(code => scope === "ALL" || code.scope_type === scope);

  function open(code?: DressCode, prefill?: Pick<DressCodeForm, "label" | "description">) {
    releasePhoto(); setPhoto(undefined); setRemovePhoto(false);
    command.clearError();
    setFormError(undefined);
    setSaved(undefined);
    setForm({ ...dressCodeForm(code, days, plan.activities), ...prefill });
  }
  const position = new Map(plan.activities.map(item => [item.id, item.position]));
  const sections = sectionMeta.filter(meta => scope === "ALL" || meta.scope === scope).flatMap(meta => {
    const rows = visible.filter(code => code.scope_type === meta.scope).sort((a, b) =>
      meta.scope === "DAY" ? (a.plan_date ?? "").localeCompare(b.plan_date ?? "")
        : meta.scope === "ACTIVITY" ? (position.get(a.activity_id ?? "") ?? Infinity) - (position.get(b.activity_id ?? "") ?? Infinity)
          : 0);
    return rows.length ? [{ ...meta, rows }] : [];
  });
  /** Editing a field clears the previous validation message. */
  function change(next: DressCodeForm) {
    setFormError(undefined);
    setForm(next);
  }
  async function submit() {
    if (!form || busy || photoLock.current) return;
    const result = dressCodeInput(form, { planVersion: plan.plan_version, days, activities: plan.activities });
    if ("error" in result) { setFormError(result.error); return; }
    setFormError(undefined);
    photoLock.current = true; setPhotoBusy(true);
    try {
      let input = result.input;
      if (photo) {
        if (uploaded.current?.uri !== photo.uri) {
          const body = new FormData();
          if (Platform.OS === 'web') {
            if (!photo.file) throw Error('Không đọc được ảnh. Hãy chọn lại.');
            body.append('file', photo.file);
          } else body.append('file', { uri: photo.uri, type: photo.mimeType, name: photo.mimeType === 'image/png' ? 'reference.png' : 'reference.jpg' } as unknown as Blob);
          const savedImage = await api.trips.uploadDressCodeImage(tripId, body);
          if (!active.current) return;
          uploaded.current = { uri: photo.uri, imageId: savedImage.image_id };
        }
        input = { ...input, reference_image_id: uploaded.current.imageId };
      } else if (removePhoto) input = { ...input, reference_image_id: null };
      const done = await command.run({ dressCodeId: form.id, ...input }, key => api.trips.saveDressCode(tripId, form.id, input, key));
      if (!done || !active.current) return;
      closeForm();
      setSaved(form.id ? "Đã lưu thay đổi cho cả nhóm." : "Đã thêm dress code cho cả nhóm.");
      await reload();
    } catch (error) { if (active.current) setFormError(errorMessage(error)); }
    finally { photoLock.current = false; if (active.current) setPhotoBusy(false); }
  }
  async function remove() {
    if (!deleting) return;
    const done = await command.run({ remove: deleting.id, version: plan.plan_version }, key => api.trips.removeDressCode(tripId, deleting.id, plan.plan_version, key));
    if (!done) return;
    setDeleting(undefined);
    setSaved("Đã xóa dress code.");
    await reload();
  }
  // Built-in suggestions: typical weather for the place and month, plus presets for matching places.
  const places = [trip.name, ...plan.selected_locations.flatMap(item => [item.name, item.address ?? ""])];
  const latitudes = plan.selected_locations.flatMap(item => item.latitude === null ? [] : [Number(item.latitude)]).filter(Number.isFinite);
  const day = form?.scope === "DAY" && form.date ? form.date : dateKey(trip.start_at, trip.timezone);
  const guessedWeather = dressWeather(dressRegion(places, latitudes.length ? latitudes.reduce((sum, value) => sum + value, 0) / latitudes.length : null), Number(day.slice(5, 7)));
  const weather = pickedWeather ?? guessedWeather;
  const chosenActivity = plan.activities.find(item => item.id === form?.activity);
  const suggestions = dressSuggestions(weather, form?.scope === "ACTIVITY" ? (chosenActivity ? [chosenActivity.title] : []) : [...places, ...plan.activities.map(item => item.title)]);
  const failure = command.error && <>
    <Feedback message={command.error} />
    <Button label="Tải kế hoạch mới nhất" variant="soft" compact onPress={() => { command.clearError(); closeForm(); setDeleting(undefined); void reload(); }} />
  </>;

  const counts: Record<string, number> = {
    ALL: plan.dress_codes.length,
    TRIP: plan.dress_codes.filter(code => code.scope_type === "TRIP").length,
    DAY: plan.dress_codes.filter(code => code.scope_type === "DAY").length,
    ACTIVITY: plan.dress_codes.filter(code => code.scope_type === "ACTIVITY").length,
  };
  // Only scopes that hold something; with a single scope in use the filter adds nothing.
  const usedFilters = filters.filter(item => item.value !== "ALL" && counts[item.value] > 0);
  const shownFilters = usedFilters.length > 1 ? filters.filter(item => item.value === "ALL" || counts[item.value] > 0) : [];
  if (scope !== "ALL" && !shownFilters.some(item => item.value === scope)) setScope("ALL");
  const editingCode = form?.id ? plan.dress_codes.find(code => code.id === form.id) : undefined;
  const hasStoredImage = !removePhoto && !!editingCode?.reference_image_available;
  const preview = form ? dressPalette(form.description) : undefined;

  return <>
    <View style={styles.toolbar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ui.flex} contentContainerStyle={styles.filters}>
        {shownFilters.map(item => <Pressable cssInterop={false} key={item.value} accessibilityRole="tab" accessibilityLabel={item.label}
          accessibilityState={{ selected: scope === item.value }} onPress={() => setScope(item.value)}
          style={({ pressed }) => [styles.filter, scope === item.value && styles.filterActive, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.filterText, scope === item.value && styles.filterTextActive]}>
            {item.label} <Text style={styles.filterCount}>{counts[item.value]}</Text>
          </Text>
        </Pressable>)}
      </ScrollView>
      {editable && <Button label="Thêm" accessibilityLabel="Thêm dress code" icon="plus" variant="soft" compact disabled={busy} onPress={() => open()} />}
    </View>
    {!editable && <Notice>Bạn có quyền xem. Quyền chỉnh sửa do người tổ chức quản lý.</Notice>}
    <Snackbar message={saved} />
    {!form && !deleting && failure}
    {plan.dress_codes.length > 0 && <View style={styles.weatherCard} accessibilityLabel={`Thời tiết thường gặp: ${weatherLabel(guessedWeather)}. ${weatherAdvice(guessedWeather)}`}>
      <Text style={styles.weatherEmoji}>{weatherIcon[guessedWeather]}</Text>
      <View style={ui.flex}>
        <Text style={typography.headline}>Thời tiết tháng {Number(dateKey(trip.start_at, trip.timezone).slice(5, 7))}: {weatherLabel(guessedWeather).toLowerCase()}</Text>
        <Text style={typography.footnote} numberOfLines={3}>{weatherAdvice(guessedWeather)}</Text>
      </View>
    </View>}

    {sections.map(section => <View key={section.scope} style={styles.section}>
      {scope === "ALL" && <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: pastelTones[section.tone].surface }]}>
          <DesignIcon name={section.icon} size={16} tintColor={colors.ink} />
        </View>
        <Text accessibilityRole="header" style={[typography.headline, ui.flex]}>{section.title}</Text>
        <Text style={styles.count}>{section.rows.length}</Text>
      </View>}
      {section.rows.map(code => {
        const palette = dressPalette(code.description);
        const body = <>
          {code.reference_image_available && <DressReferenceImage key={`${code.id}:${plan.plan_version}`} api={api} tripId={tripId} dressCodeId={code.id} label={code.label} />}
          {code.reference_image_available && !!palette.colors.length && <View style={styles.strip}><Swatches colors={palette.colors} tone={section.tone} icon={section.icon} /></View>}
          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <View style={[styles.scopeChip, { backgroundColor: pastelTones[section.tone].surface }]}>
                <DesignIcon name={section.icon} size={13} tintColor={colors.ink} />
                <Text numberOfLines={1} style={styles.scopeText}>{dressScopeLabel(code, plan.activities)}</Text>
              </View>
              {editable && <DesignIcon name="edit" size={16} tintColor={colors.muted} />}
            </View>
            <Text accessibilityRole="header" style={styles.cardTitle}>{code.label}</Text>
            {!!palette.colors.length && <View style={styles.swatchRow} accessibilityLabel={`Tông màu: ${palette.colors.map(item => item.name).join(", ")}`}>
              {palette.colors.map(item => <View key={item.hex} style={styles.swatchItem}>
                <View style={[styles.swatchDot, { backgroundColor: item.hex }]} />
                <Text style={styles.swatchName}>{item.name}</Text>
              </View>)}
            </View>}
            {!!palette.rest && <Text style={[typography.body, { color: colors.muted }]} numberOfLines={4}>{palette.rest}</Text>}
          </View>
        </>;
        return editable
          ? <Pressable cssInterop={false} key={code.id} accessibilityRole="button" accessibilityLabel={`Sửa ${code.label}`} disabled={busy}
            onPress={() => open(code)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>{body}</Pressable>
          : <View key={code.id} style={styles.card}>{body}</View>;
      })}
    </View>)}

    {!visible.length && <EmptyState icon="shirt"
      title={plan.dress_codes.length ? "Chưa có dress code ở phạm vi này" : "Chưa có dress code"}
      message={plan.dress_codes.length ? "Chọn phạm vi khác để xem các hướng dẫn đã lưu." : editable ? "Chọn nhanh một gợi ý bên dưới hoặc bấm + để tự thêm cho cả nhóm." : "Hướng dẫn trang phục của nhóm sẽ xuất hiện tại đây."}
      action={editable && !plan.dress_codes.length ? <View style={styles.suggestions}>
        {suggestions.map(suggestion => <SuggestionCard key={suggestion.id} suggestion={suggestion} label={`Bắt đầu từ gợi ý ${suggestion.label}`} disabled={busy}
          onPress={() => open(undefined, { label: suggestion.label, description: dressSuggestionText(suggestion) })} />)}
      </View> : undefined} />}

    <Sheet visible={!!form} title={form?.id ? "Sửa dress code" : "Thêm dress code"} dismissible={!busy} onClose={closeForm}>
      {form && <>
        <View style={ui.stack}>
          <Text style={styles.label}>Áp dụng cho</Text>
          <Segments scroll value={form.scope} items={dressScopes} onChange={value => { if (!busy) change({ ...form, scope: value }); }} />
          {form.scope === "DAY" && <Segments scroll value={form.date} items={days.map(value => ({ value, label: dressDayLabel(value) }))} onChange={date => { if (!busy) change({ ...form, date }); }} />}
          {form.scope === "ACTIVITY" && (plan.activities.length
            ? <Segments scroll value={form.activity} items={plan.activities.map(item => ({ value: item.id, label: item.title }))} onChange={activity => { if (!busy) change({ ...form, activity }); }} />
            : <Text style={typography.footnote}>Chưa có hoạt động nào trong lịch trình.</Text>)}
        </View>
        <View style={styles.suggestBox}>
          <Text style={styles.label}>Gợi ý nhanh</Text>
          <View style={styles.weather}>
            {dressWeatherOptions.map(option => <Pressable cssInterop={false} key={option.value} accessibilityRole="tab" accessibilityLabel={option.label}
              accessibilityState={{ selected: weather === option.value, disabled: busy }} disabled={busy} onPress={() => setPickedWeather(option.value)}
              style={({ pressed }) => [styles.weatherChip, weather === option.value && styles.weatherChipActive, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.weatherText, weather === option.value && styles.filterTextActive]}>{weatherIcon[option.value]} {option.label}</Text>
            </Pressable>)}
          </View>
          <Text style={typography.footnote}>{weather === guessedWeather ? "Đoán theo nơi và tháng đi. " : ""}Chạm một gợi ý để điền sẵn, rồi sửa lại nếu cần.</Text>
          <View style={styles.suggestions}>
            {suggestions.map(suggestion => <SuggestionCard key={suggestion.id} suggestion={suggestion} label={`Dùng gợi ý ${suggestion.label}`} disabled={busy}
              selected={form.label === suggestion.label} onPress={() => change({ ...form, label: suggestion.label, description: dressSuggestionText(suggestion) })} />)}
          </View>
        </View>
        <FormField label="Tên dress code" icon="edit" value={form.label} maxLength={DRESS_LABEL_MAX} editable={!busy} placeholder="Ví dụ: Trắng bên biển" onChangeText={label => change({ ...form, label })} />
        <FormField label="Mô tả trang phục" icon="edit" value={form.description} multiline maxLength={5000} editable={!busy} placeholder="Màu sắc, kiểu đồ, lưu ý…" onChangeText={description => change({ ...form, description })} />
        {!!preview?.colors.length && <View style={styles.previewRow} accessibilityLabel={`Tông màu: ${preview.colors.map(item => item.name).join(", ")}`}>
          <View style={styles.previewBand}><Swatches colors={preview.colors} tone="blue" icon="shirt" compact /></View>
          <Text style={styles.colorNames}>{preview.colors.map(item => item.name).join(" · ")}</Text>
        </View>}
        {plan.capabilities?.dress_code_images_write && <View style={ui.stack}>
          <Text style={styles.label}>Ảnh tham khảo</Text>
          <Text style={typography.footnote}>Một ảnh JPG/PNG tối đa 2 MB, chia sẻ với thành viên trong chuyến đi.</Text>
          <View style={styles.photoRow}>
            {photo ? <Image source={{ uri: photo.uri }} contentFit="cover" accessibilityLabel="Ảnh tham khảo đã chọn" style={styles.photo} />
              : hasStoredImage && form.id ? <DressReferenceImage api={api} tripId={tripId} dressCodeId={form.id} label={form.label} variant="thumb" />
                : <View style={[styles.photo, styles.photoEmpty]}><DesignIcon name="shirt" size={26} tintColor={colors.muted} /></View>}
            <View style={styles.photoActions}>
              <Button label={photo || hasStoredImage ? 'Đổi ảnh tham khảo' : 'Chọn ảnh tham khảo'} variant="soft" compact disabled={busy} onPress={() => { void choosePhoto(); }} />
              {(photo || hasStoredImage) && <Button label="Bỏ ảnh tham khảo" variant="text" compact disabled={busy} onPress={() => { releasePhoto(); setPhoto(undefined); setRemovePhoto(true); }} />}
            </View>
          </View>
        </View>}
        {formError && <Feedback message={formError} />}
        {failure}
        <Button label={form.id ? "Lưu thay đổi" : "Thêm cho cả nhóm"} loading={busy} onPress={() => { void submit(); }} />
        {editingCode && <Button label="Xóa dress code này" variant="text" compact disabled={busy}
          onPress={() => { command.clearError(); setSaved(undefined); closeForm(); setDeleting(editingCode); }} />}
      </>}
    </Sheet>
    <Sheet visible={!!deleting} title="Xóa dress code?" dismissible={!busy} onClose={() => setDeleting(undefined)}>
      <Text style={typography.body}>“{deleting?.label}” sẽ bị xóa khỏi kế hoạch chung của cả nhóm.</Text>
      {failure}
      <Button label="Xóa dress code" variant="destructive" loading={busy} onPress={() => { void remove(); }} />
      <Button label="Giữ lại" variant="soft" disabled={busy} onPress={() => setDeleting(undefined)} />
    </Sheet>
  </>;
}

const filters = [
  { value: "ALL", label: "Tất cả" },
  { value: "TRIP", label: "Cả chuyến" },
  { value: "DAY", label: "Theo ngày" },
  { value: "ACTIVITY", label: "Hoạt động" },
];
const weatherIcon: Record<DressWeather, string> = { HOT: "☀️", RAINY: "🌧️", COOL: "🍃", COLD: "❄️" };
const weatherLabel = (value: DressWeather) => dressWeatherOptions.find(option => option.value === value)?.label ?? "";
const weatherAdvice = (value: DressWeather) => dressSuggestions(value, [])[0]?.advice ?? "";

/** The palette as one bold colour band — the card's "look" at a glance. */
function Swatches({ colors: palette, tone, icon, compact = false }: { colors: readonly DressColor[]; tone: PastelTone; icon: DesignIconName; compact?: boolean }) {
  if (!palette.length) {
    return <View style={[compact ? styles.bandCompact : styles.band, styles.bandEmpty, { backgroundColor: pastelTones[tone].surface }]}>
      <DesignIcon name={icon === "trip" ? "shirt" : icon} size={22} tintColor={colors.ink} />
    </View>;
  }
  return <View style={compact ? styles.bandCompact : styles.band} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {palette.map(item => <View key={item.hex} style={[styles.bandColor, { backgroundColor: item.hex }]} />)}
  </View>;
}

function SuggestionCard({ suggestion, label, selected = false, disabled, onPress }: {
  suggestion: DressSuggestion; label: string; selected?: boolean; disabled: boolean; onPress: () => void;
}) {
  return <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.suggestion, selected && styles.suggestionActive, pressed && { opacity: 0.75 }]}>
    <View style={styles.dots}>
      {suggestion.colors.map((item, index) => <View key={item.hex} style={[styles.suggestionDot, { backgroundColor: item.hex, marginLeft: index ? -8 : 0 }]} />)}
    </View>
    <View style={ui.flex}>
      <Text style={styles.suggestionTitle}>{suggestion.label}</Text>
      <Text numberOfLines={1} style={styles.suggestionText}>{suggestion.colors.map(item => item.name).join(" · ")}</Text>
    </View>
    <Text style={[styles.suggestionUse, selected && { color: colors.pinGreen }]}>{selected ? "✓" : "Dùng"}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  filters: { flexDirection: "row", gap: 6, paddingVertical: 2 },
  filter: { minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.surface },
  filterActive: { backgroundColor: colors.ink },
  filterText: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
  filterTextActive: { color: colors.surface },
  filterCount: { opacity: 0.6, fontVariant: ["tabular-nums"] },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  sectionIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  count: { minWidth: 26, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, overflow: "hidden", textAlign: "center", backgroundColor: colors.surface, color: colors.muted, fontFamily: fonts.bold, fontSize: 13 },
  card: { borderRadius: radii.card, backgroundColor: colors.surface, overflow: "hidden", ...shadows.glass },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  band: { height: 64, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line },
  bandCompact: { width: 72, height: 28, flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  bandEmpty: { height: 44, alignItems: "center", justifyContent: "center" },
  bandColor: { flex: 1 },
  cardBody: { gap: 8, padding: 16 },
  cardTitle: { ...typography.section, fontSize: 19, lineHeight: 25 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatchItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatchDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.line },
  swatchName: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
  weatherCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  weatherEmoji: { fontSize: 30, lineHeight: 36 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  scopeChip: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  scopeText: { flexShrink: 1, color: colors.ink, fontFamily: fonts.bold, fontSize: 12 },
  colorNames: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold, textTransform: "capitalize" },
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.bold },
  suggestBox: { gap: 10, padding: 14, borderRadius: radii.card, backgroundColor: colors.surface },
  weather: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  weatherChip: { minHeight: 34, justifyContent: "center", paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: colors.fill },
  weatherChipActive: { backgroundColor: colors.ink },
  weatherText: { color: colors.ink, fontSize: 12, fontFamily: fonts.bold },
  suggestions: { gap: 8, alignSelf: "stretch" },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  suggestionActive: { borderColor: colors.pinGreen, backgroundColor: colors.mintCanvas },
  dots: { flexDirection: "row" },
  suggestionDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line },
  suggestionTitle: { color: colors.ink, fontSize: 14, fontFamily: fonts.bold },
  suggestionText: { color: colors.muted, fontSize: 12 },
  suggestionUse: { color: colors.teal, fontSize: 13, fontFamily: fonts.bold },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewBand: { flexShrink: 0 },
  strip: { height: 8, overflow: "hidden" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  photo: { width: 88, height: 88, borderRadius: 16 },
  photoEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.fill, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.line },
  photoActions: { flex: 1, gap: 4, alignItems: "flex-start" },
});
