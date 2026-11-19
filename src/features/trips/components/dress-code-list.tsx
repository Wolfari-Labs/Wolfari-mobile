import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { errorMessage } from '@/shared/api/errors';
import { DressReferenceImage } from './dress-reference-image';

import { useCommand } from "@/shared/hooks/use-command";
import { colors, fonts, pastelTones, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import type { DesignIconName } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import { EmptyState, IconButton, Notice, Segments, ui } from "@/shared/ui/journal";
import { PastelIcon, type PastelTone } from "@/shared/ui/pastel";
import { Sheet } from "@/shared/ui/sheet";
import type { useTrip } from "../hooks/use-trip";
import { dressCodeForm, dressCodeInput, dressDayLabel, dressScopeLabel, dressScopes, DRESS_LABEL_MAX, type DressCodeForm } from "../model/dress-code";
import { dressPalette, dressRegion, dressSuggestionText, dressSuggestions, dressWeather, dressWeatherOptions, type DressWeather } from "../model/dress-suggestions";
import type { DressCode, Plan, Trip } from "../types";
import { dateKey } from "../utils";

const sectionMeta: { scope: DressCode["scope_type"]; title: string; icon: DesignIconName; tone: PastelTone }[] = [
  { scope: "TRIP", title: "Cho cả chuyến", icon: "trip", tone: "mint" },
  { scope: "DAY", title: "Theo từng ngày", icon: "calendar", tone: "blue" },
  { scope: "ACTIVITY", title: "Theo hoạt động", icon: "pin", tone: "peach" },
];

type TripApi = ReturnType<typeof useTrip>["api"];
type Props = { api: TripApi; trip: Pick<Trip, "id" | "name" | "start_at" | "timezone">; plan: Plan; days: string[]; scope: string; reload: () => Promise<unknown> | void };

/** Dress codes saved on the server and shared with the whole group (FR-PL03). */
export function DressCodeList({ api, trip, plan, days, scope, reload }: Props) {
  const tripId = trip.id;
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

  return <>
    {saved && <Feedback success message={saved} />}
    {editable
      ? <Button label="Thêm dress code" icon="plus" disabled={busy} onPress={() => open()} />
      : <Notice>Bạn có quyền xem. Quyền chỉnh sửa do người tổ chức quản lý.</Notice>}
    {sections.map(section => <View key={section.scope} style={styles.section}>
      {scope === "ALL" && <View style={styles.sectionHeader}>
        <PastelIcon small icon={section.icon} tone={section.tone} />
        <Text accessibilityRole="header" style={[typography.headline, ui.flex]}>{section.title}</Text>
        <Text style={styles.count}>{section.rows.length}</Text>
      </View>}
      {section.rows.map(code => {
        const palette = dressPalette(code.description);
        return <View key={code.id} style={[styles.card, { borderColor: pastelTones[section.tone].surface }]}>
          <View style={styles.cardTop}>
            <View style={[styles.scopeChip, { backgroundColor: pastelTones[section.tone].surface }]}>
              <DesignIcon name={section.icon} size={14} tintColor={colors.ink} />
              <Text numberOfLines={1} style={styles.scopeText}>{dressScopeLabel(code, plan.activities)}</Text>
            </View>
            {editable && <View style={styles.actions}>
              <IconButton icon="edit" label={`Sửa ${code.label}`} disabled={busy} onPress={() => open(code)} />
              <Button compact variant="text" label="Xóa" accessibilityLabel={`Xóa ${code.label}`} disabled={busy} onPress={() => { command.clearError(); setSaved(undefined); setDeleting(code); }} />
            </View>}
          </View>
          <Text accessibilityRole="header" style={typography.section}>{code.label}</Text>
          {!!palette.colors.length && <View style={styles.swatches} accessibilityLabel={`Tông màu: ${palette.colors.map(item => item.name).join(", ")}`}>
            {palette.colors.map(item => <View key={item.hex} style={styles.swatch}>
              <View style={[styles.dot, { backgroundColor: item.hex }]} />
              <Text style={styles.swatchText}>{item.name}</Text>
            </View>)}
          </View>}
          {!!palette.rest && <Text style={[typography.body, { color: colors.muted }]}>{palette.rest}</Text>}
          {code.reference_image_available && <DressReferenceImage key={`${code.id}:${plan.plan_version}`} api={api} tripId={tripId} dressCodeId={code.id} label={code.label} />}
        </View>;
      })}
    </View>)}
    {!visible.length && <EmptyState icon="shirt"
      title={plan.dress_codes.length ? "Chưa có dress code ở phạm vi này" : "Chưa có dress code"}
      message={plan.dress_codes.length ? "Chọn phạm vi khác để xem các hướng dẫn đã lưu." : editable ? "Chọn nhanh một gợi ý bên dưới hoặc tự thêm để cả nhóm cùng chuẩn bị." : "Hướng dẫn trang phục của nhóm sẽ xuất hiện tại đây."}
      action={editable && !plan.dress_codes.length ? <View style={styles.quick}>
        {suggestions.map(suggestion => <Button key={suggestion.id} compact variant="soft" label={suggestion.label} accessibilityLabel={`Bắt đầu từ gợi ý ${suggestion.label}`} disabled={busy}
          onPress={() => open(undefined, { label: suggestion.label, description: dressSuggestionText(suggestion) })} />)}
      </View> : undefined} />}

    <Sheet visible={!!form} title={form?.id ? "Sửa dress code" : "Thêm dress code"} dismissible={!busy} onClose={closeForm}>
      {form && <>
        <FormField label="Tên dress code" icon="edit" value={form.label} maxLength={DRESS_LABEL_MAX} editable={!busy} placeholder="Ví dụ: Trắng bên biển" onChangeText={label => change({ ...form, label })} />
        <View style={ui.stack}>
          <Text style={typography.headline}>Áp dụng</Text>
          <Segments scroll value={form.scope} items={dressScopes} onChange={value => { if (!busy) change({ ...form, scope: value }); }} />
        </View>
        {form.scope === "DAY" && <View style={ui.stack}>
          <Text style={typography.headline}>Ngày áp dụng</Text>
          <Segments scroll value={form.date} items={days.map(value => ({ value, label: dressDayLabel(value) }))} onChange={date => { if (!busy) change({ ...form, date }); }} />
        </View>}
        {form.scope === "ACTIVITY" && <View style={ui.stack}>
          <Text style={typography.headline}>Hoạt động áp dụng</Text>
          {plan.activities.length
            ? <Segments scroll value={form.activity} items={plan.activities.map(item => ({ value: item.id, label: item.title }))} onChange={activity => { if (!busy) change({ ...form, activity }); }} />
            : <Text style={typography.footnote}>Chưa có hoạt động nào trong lịch trình.</Text>}
        </View>}
        <View style={ui.stack}>
          <Text style={typography.headline}>Gợi ý theo thời tiết</Text>
          <Segments scroll value={weather} items={dressWeatherOptions.map(option => ({ value: option.value, label: option.label }))} onChange={value => { if (!busy) setPickedWeather(value); }} />
          <Text style={typography.footnote}>{weather === guessedWeather ? "Đang chọn theo nơi và tháng đi. " : ""}Chạm một gợi ý để điền sẵn, rồi sửa lại nếu cần.</Text>
          {suggestions.map(suggestion => <View key={suggestion.id} style={[ui.row, { flexWrap: "wrap" }]}>
            <View style={{ flexDirection: "row" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {suggestion.colors.map((item, index) => <View key={item.hex} style={{ width: 18, height: 18, borderRadius: 9, marginLeft: index ? -6 : 0, borderWidth: 1, borderColor: colors.line, backgroundColor: item.hex }} />)}
            </View>
            <Button compact variant="soft" label={suggestion.label} accessibilityLabel={`Dùng gợi ý ${suggestion.label}`} disabled={busy} onPress={() => change({ ...form, label: suggestion.label, description: dressSuggestionText(suggestion) })} />
          </View>)}
        </View>
        <FormField label="Mô tả trang phục" icon="edit" value={form.description} multiline maxLength={5000} editable={!busy} placeholder="Màu sắc, kiểu đồ, lưu ý…" onChangeText={description => change({ ...form, description })} />
        {plan.capabilities?.dress_code_images_write && <View style={ui.stack}>
          <Text style={typography.headline}>Ảnh tham khảo</Text>
          <Text style={typography.footnote}>Một ảnh JPG/PNG tối đa 2 MB, chia sẻ với thành viên trong chuyến đi.</Text>
          {photo ? <Image source={{ uri: photo.uri }} contentFit="contain" accessibilityLabel="Ảnh tham khảo đã chọn" style={{ width: '100%', height: 220, borderRadius: 16 }} /> : !removePhoto && form.id && plan.dress_codes.find(code => code.id === form.id)?.reference_image_available ? <DressReferenceImage api={api} tripId={tripId} dressCodeId={form.id} label={form.label} initiallyOpen /> : null}
          <Button label={photo || (!removePhoto && form.id && plan.dress_codes.find(code => code.id === form.id)?.reference_image_available) ? 'Đổi ảnh tham khảo' : 'Chọn ảnh tham khảo'} variant="soft" disabled={busy} onPress={() => { void choosePhoto(); }} />
          {(photo || (!removePhoto && form.id && plan.dress_codes.find(code => code.id === form.id)?.reference_image_available)) && <Button label="Bỏ ảnh tham khảo" variant="text" disabled={busy} onPress={() => { releasePhoto(); setPhoto(undefined); setRemovePhoto(true); }} />}
        </View>}
        {formError && <Feedback message={formError} />}
        {failure}
        <Button label={form.id ? "Lưu thay đổi" : "Thêm cho cả nhóm"} loading={busy} onPress={() => { void submit(); }} />
      </>}
    </Sheet>
    <Sheet visible={!!deleting} title="Xóa dress code?" dismissible={!busy} onClose={() => setDeleting(undefined)}>
      <Text style={typography.body}>“{deleting?.label}” sẽ bị xóa khỏi kế hoạch chung của cả nhóm.</Text>
      {failure}
      <Button label="Xóa dress code" variant="destructive" loading={busy} onPress={() => { void remove(); }} />
    </Sheet>
  </>;
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  count: { minWidth: 26, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, overflow: "hidden", textAlign: "center", backgroundColor: colors.fill, color: colors.muted, fontFamily: fonts.bold, fontSize: 13 },
  card: { gap: 10, padding: 16, borderRadius: radii.card, borderWidth: 1.5, backgroundColor: colors.surface, ...shadows.glass },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  scopeChip: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill },
  scopeText: { flexShrink: 1, color: colors.ink, fontFamily: fonts.bold, fontSize: 13 },
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatch: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.fill },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.line },
  swatchText: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
  quick: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
});
