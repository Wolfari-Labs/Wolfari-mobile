import { DesignPopup } from "@/shared/ui/design-popup";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { useCreateTripRequest } from "../hooks/use-create-trip-request";
import { useLocalDraft } from "@/shared/storage/use-local-draft";
import { colors, fonts, gradients, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { ClayAmount, ClayChip, ClayDateField, ClayField, ClaySelect } from "@/shared/ui/clay-form";
import type { ClayIconName } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Details } from "@/shared/ui/details";
import { Feedback } from "@/shared/ui/feedback";
import { Heading, Notice } from "@/shared/ui/journal";
import { LoadingOverlay } from "@/shared/ui/loading-overlay";
import { Screen } from "@/shared/ui/screen";
import { CardIcon, ClayButton, ClayIcon, claySubtitle } from "@/shared/ui/setting-card";
import { Sheet } from "@/shared/ui/sheet";
import { coverFor } from "../components/trip-card";
import { PRESET_COVERS, presetCoverBody } from "../components/preset-cover";
import { coverBody, coverProblem } from "../components/trip-cover";
import { emptyCreateDraft, isCreateDraft, money, moneyLabel, type CreateDraft } from "../model/local-parity";
import { TIMEZONES } from "../model/timezones";
import { localTimestamp, parseDate } from "../utils";

const defaultTimezone = "Asia/Ho_Chi_Minh";
const createSteps = [
  { value: "info", label: "Thông tin" },
  { value: "details", label: "Cá nhân hóa" },
] as const;
const tripStyles: { key: string; label: string; icon: ClayIconName; tone: "blue" | "butter" | "peach" | "lilac" }[] = [
  { key: "explore", label: "Khám phá", icon: "styleExplore", tone: "blue" },
  { key: "relax", label: "Nghỉ dưỡng", icon: "styleRelax", tone: "butter" },
  { key: "food", label: "Ẩm thực", icon: "styleFood", tone: "peach" },
  { key: "culture", label: "Văn hóa", icon: "styleCulture", tone: "lilac" },
];
const memberChoices = Array.from({ length: 20 }, (_, index) => String(index + 1));
const destinations = ["Đà Nẵng", "Hội An", "Phú Quốc", "Đà Lạt"];
type CreateStep = (typeof createSteps)[number]["value"];

export default function CreateTripScreen() {
  const { idea } = useLocalSearchParams<{ idea?: string }>();
  const { profile } = useSession();
  const draft = useLocalDraft("new-trip", "create", isCreateDraft);
  if (!draft.ready) return <Screen title="Chuyến đi mới"><Notice>{draft.error ?? "Đang khôi phục bản nháp…"}</Notice>{draft.error && <Button label="Xóa bản nháp không đọc được" loading={draft.busy} onPress={() => { void draft.clear(); }} />}</Screen>;
  return <CreateTripForm key={profile?.id} initial={draft.value ?? { ...emptyCreateDraft, name: idea ?? "" }} draft={draft} />;
}

function CreateTripForm({ initial, draft }: { initial: CreateDraft; draft: ReturnType<typeof useLocalDraft<CreateDraft>> }) {
  const api = useApi();
  const command = useCreateTripRequest();
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState<CreateStep>("info");
  const [validation, setValidation] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showDestinations, setShowDestinations] = useState(false);
  const [showTimezones, setShowTimezones] = useState(false);
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset>();
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [created, setCreated] = useState<{ id: string; coverFailed: boolean }>();
  // The request sent from this screen: progress shows over the form instead of the recovery page,
  // which is only for a request left from an earlier visit.
  const [submitting, setSubmitting] = useState(false);
  const busy = !!created || !command.ready || command.busy || draft.busy || !!command.pending || uploading;
  const timezone = form.timezone ?? defaultTimezone;
  const selectedTimezone = TIMEZONES.find(item => item.value === timezone);
  const timezoneOptions = selectedTimezone ? TIMEZONES : [{ value: timezone, label: timezone }, ...TIMEZONES];
  const hasDraft = !!(draft.value || cover || form.name || form.start || form.end ||
    form.description || form.budget || form.destination || form.style || timezone !== defaultTimezone ||
    form.members !== emptyCreateDraft.members || form.cover !== emptyCreateDraft.cover);
  const update = (key: keyof CreateDraft, value: string) => {
    if (busy) return;
    setForm(old => ({ ...old, [key]: value }));
    setSaved(false);
    setValidation(undefined);
  };
  const tripStyleKeys = form.style.split(",").filter(Boolean);
  const fallbackCover = coverFor({ name: form.name });
  const destinationCover = form.destination.trim() ? coverFor({ name: form.destination }) : fallbackCover;
  const preset = PRESET_COVERS.find(item => item.key === form.cover);
  const presetOptions = PRESET_COVERS.some(item => item.source === destinationCover)
    ? PRESET_COVERS
    : [{ key: emptyCreateDraft.cover, label: "Theo điểm đến", source: destinationCover }, ...PRESET_COVERS];
  const selectedSource = preset?.source ?? destinationCover;
  const shouldUploadCover = !!cover || !!preset || selectedSource !== fallbackCover;
  const shownCover = cover ? { uri: cover.uri } : selectedSource;
  const memberCount = Math.max(1, Number(form.members) || 1);
  const budgetValue = money(form.budget);
  const perPerson = budgetValue ? Math.floor(budgetValue / memberCount) : 0;
  // Each step validates only its own fields.
  function validInfo() {
    if (!form.name.trim() || form.name.trim().length > 200) { setValidation("Tên chuyến đi cần từ 1 đến 200 ký tự."); return; }
    const first = parseDate(form.start), last = parseDate(form.end);
    if (!first || !last) { setValidation("Nhập ngày hợp lệ theo định dạng DD/MM/YYYY."); return; }
    if (last < first) { setValidation("Ngày về cần bằng hoặc sau ngày khởi hành."); return; }
    setValidation(undefined);
    const startAt = localTimestamp(first, "00:00", timezone), endAt = localTimestamp(last, "23:59", timezone);
    if (!startAt || !endAt) { setValidation("Múi giờ chưa hợp lệ. Hãy chọn lại múi giờ của chuyến đi."); return; }
    return { name: form.name.trim(), start_at: startAt, end_at: endAt, timezone };
  }
  function validDetails() {
    if (form.budget && !money(form.budget)) { setValidation("Ngân sách là số nguyên VND lớn hơn 0, tối đa 12 chữ số."); return false; }
    setValidation(undefined);
    return true;
  }
  function goTo(next: CreateStep) {
    if (busy || next === step) return;
    if (next === "info") { setValidation(undefined); setStep("info"); return; }
    if (validInfo()) setStep("details");
  }
  async function submit() {
    if (busy) return;
    const info = validInfo();
    if (!info) { setStep("info"); return; }
    if (step === "info") { setStep("details"); return; }
    if (!validDetails()) return;
    const budget = money(form.budget);
    // The server has no destination/style fields; they open the note every member sees.
    const styleNames = tripStyles.filter(item => tripStyleKeys.includes(item.key)).map(item => item.label).join(", ");
    const description = [form.destination.trim() && `Điểm đến: ${form.destination.trim()}`, styleNames && `Phong cách: ${styleNames}`, form.description.trim()].filter(Boolean).join("\n").slice(0, 5000);
    setSubmitting(true);
    try {
      const tripId = await command.start({
        ...info,
        ...(description ? { description } : {}),
        ...(budget ? { budget_amount: String(budget) } : {}),
      });
      if (tripId) await finish(tripId);
    } finally { setSubmitting(false); }
  }
  async function finish(tripId: string) {
    // The trip exists already; a failed cover upload must never block opening it.
    let coverFailed = false;
    if (shouldUploadCover) {
      setUploading(true);
      try { await api.trips.uploadCover(tripId, cover ? coverBody(cover) : await presetCoverBody(selectedSource)); }
      catch { coverFailed = true; }
      finally { setUploading(false); }
    }
    if (await draft.clear() && await command.acknowledge()) {
      setCreated({ id: tripId, coverFailed });
    }
    else setValidation("Chuyến đi đã tạo. Hãy thử mở lại chuyến đi; không tạo thêm chuyến mới.");
  }
  async function chooseCover() {
    if (busy || picking) return;
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: false });
      if (!result.canceled) {
        const asset = result.assets[0];
        const problem = coverProblem(asset);
        if (problem) { setValidation(problem); return; }
        setValidation(undefined);
        setCover(asset);
        update("cover", "tripCover");
      }
    } catch { setValidation("Không mở được thư viện ảnh. Hãy thử lại."); }
    finally { setPicking(false); }
  }
  async function discardDraft() {
    if (!(await draft.clear())) return;
    setForm({ ...emptyCreateDraft });
    setCover(undefined);
    setSaved(false);
    setDiscard(false);
    setStep("info");
    setValidation(undefined);
  }

  if (!command.ready || (command.pending && !submitting && !created)) return <Screen title="Chuyến đi mới">
    <Heading title={command.pending?.tripId ? "Chuyến đi đã được tạo" : "Khôi phục yêu cầu tạo chuyến đi"} />
    {command.error && <Feedback message={command.error} />}
    {validation && <Feedback message={validation} />}
    {!command.ready ? <Button label="Thử đọc lại yêu cầu" loading={command.busy} onPress={() => { void command.load(); }} /> : <>
      <Text style={typography.headline}>{command.pending!.input.name}</Text>
      <Notice>{command.pending!.tripId ? "Yêu cầu đã hoàn tất. Mở chuyến đi để tiếp tục." : "Yêu cầu trước đã được lưu. Gửi lại yêu cầu này để kiểm tra kết quả; app sẽ không tạo thêm chuyến đi trùng."}</Notice>
      <Button label={command.pending!.tripId ? "Mở chuyến đi đã tạo" : "Gửi lại yêu cầu đã lưu"} loading={command.busy || draft.busy || uploading} onPress={() => { void (async () => { const tripId = await command.retry(); if (tripId) await finish(tripId); })(); }} />
    </>}
  </Screen>;
  const previewName = form.destination.trim() || form.name.trim();
  return (
    <Screen
      key={step}
      clay
      title="Chuyến đi mới"
      onBack={() => {
        if (command.busy || draft.busy) return;
        if (step === "details") goTo("info");
        else if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/trips");
      }}
      footer={
        <ClayButton label={step === "info" ? "Tiếp tục" : "Tạo chuyến đi"} icon="arrowRight"
          disabled={busy || picking} loading={command.busy || uploading} onPress={() => { void submit(); }} />
      }
    >
      <View accessibilityRole="tablist" style={styles.stepper}>
        {createSteps.map(({ value, label }, index) => {
          const active = step === value, done = step === "details" && value === "info";
          return (
            <View key={value} style={styles.stepItem}>
              {index > 0 && <View style={[styles.connector, step === "details" && { backgroundColor: colors.gradientMint }]} />}
              <Pressable cssInterop={false} accessibilityRole="tab"
                accessibilityLabel={`${index + 1}  ${label}`}
                accessibilityState={{ selected: active, disabled: busy || picking }} aria-selected={active}
                disabled={busy || picking} hitSlop={6} onPress={() => goTo(value)}
                style={({ pressed }) => [styles.step, pressed && styles.pressed]}>
                {active && <LinearGradient pointerEvents="none" colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: radii.pill }]} />}
                <View style={[styles.stepNumber, active && styles.stepNumberActive, done && { backgroundColor: colors.mint }]}>
                  {done ? <ClayIcon name="checkMint" size={14} /> : <Text style={[styles.stepNumberText, active && { color: colors.surface }]}>{index + 1}</Text>}
                </View>
                <Text style={[styles.stepLabel, active && { color: colors.surface }, done && { color: colors.ink }]}>{label}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {validation && <Feedback message={validation} />}
      {command.error && <Feedback message={command.error} />}
      {draft.error && <Feedback message={draft.error} />}

      {step === "info" ? (
        <>
          <Text accessibilityRole="header" style={styles.headline}>Hành trình bắt đầu từ một ý tưởng</Text>
          <ClayField label="Tên chuyến đi" icon="fieldEdit" value={form.name} onChangeText={value => update("name", value)}
            placeholder="Ví dụ: Đà Nẵng 3N2Đ" maxLength={200} editable={!busy} />
          <ClayField label="Điểm đến chính" icon="fieldPin" tone="mint" value={form.destination} onChangeText={value => update("destination", value)}
            placeholder="Nhập hoặc chọn điểm đến" maxLength={120} editable={!busy}
            trailing={<Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Chọn điểm đến" disabled={busy}
              hitSlop={6} style={styles.destinationPicker} onPress={() => setShowDestinations(true)}><ClayIcon name="chevronDown" size={18} /></Pressable>} />
          <View style={styles.dates}>
            <View style={styles.flex}>
              <ClayDateField label="Ngày đi" value={form.start} onChangeText={value => {
                update("start", value);
                const first = parseDate(value), last = parseDate(form.end);
                if (first && last && last < first) update("end", value);
              }} editable={!busy} />
            </View>
            <View style={styles.flex}>
              <ClayDateField label="Ngày về" value={form.end} minimum={parseDate(form.start) ? form.start : undefined}
                onChangeText={value => update("end", value)} editable={!busy} />
            </View>
          </View>
          <ClaySelect label="Số thành viên dự kiến" value={`${memberCount} người`} icon="fieldUsers" tone="lilac" disabled={busy} onPress={() => setShowMembers(true)} />
          {!!previewName && <View style={styles.preview}>
            <Image source={shownCover} style={styles.previewImage} contentFit="cover" accessible={false} />
            <View style={styles.flex}>
              <Text style={styles.previewTitle} numberOfLines={1}>{previewName}</Text>
              <Text style={claySubtitle} numberOfLines={2}>{form.start && form.end ? `${form.start} – ${form.end} · ${memberCount} người` : "Những ngày khám phá cùng nhau."}</Text>
            </View>
          </View>}
          <Details title="Tùy chọn múi giờ">
            <ClaySelect label="Múi giờ chuyến đi" value={selectedTimezone?.label ?? timezone} icon="fieldCalendar" tone="butter" disabled={busy} onPress={() => setShowTimezones(true)} />
          </Details>
        </>
      ) : (
        <>
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={styles.headline}>Theo cách của bạn</Text>
            <Text style={styles.lead}>Chọn phong cách và ngân sách chung.</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Phong cách chuyến đi</Text>
            <View style={styles.styleGrid}>
              {tripStyles.map(item => {
                const checked = tripStyleKeys.includes(item.key);
                return <Pressable key={item.key} cssInterop={false} accessibilityRole="checkbox" accessibilityLabel={item.label} accessibilityState={{ checked, disabled: busy }} aria-checked={checked} disabled={busy}
                  onPress={() => update("style", (checked ? tripStyleKeys.filter(key => key !== item.key) : [...tripStyleKeys, item.key]).join(","))}
                  style={({ pressed }) => [styles.styleCard, checked && { borderColor: colors.blue }, pressed && styles.pressed]}>
                  <CardIcon icon={item.icon} tone={item.tone} size={36} />
                  <Text style={styles.styleLabel}>{item.label}</Text>
                  {checked && <SelectedMark size={20} />}
                </Pressable>;
              })}
            </View>
          </View>
          <View style={styles.budgetCard}>
            <Text style={styles.budgetLabel}>Ngân sách dự kiến cả nhóm</Text>
            <ClayAmount label="Ngân sách dự kiến (VND)" value={form.budget} onChangeText={value => update("budget", value)} maxDigits={12} editable={!busy} />
            <Text style={claySubtitle}>{budgetValue ? `≈ ${moneyLabel(perPerson)} / người · ${memberCount} thành viên` : "Nhập số tiền dự kiến hoặc để trống."}</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Ảnh bìa chuyến đi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coverScroll} contentContainerStyle={styles.covers}>
              {cover && <CoverOption label="Ảnh của bạn" source={{ uri: cover.uri }} selected disabled={busy || picking} onPress={() => { void chooseCover(); }} />}
              {presetOptions.map(item => <CoverOption key={item.key} label={item.label} source={item.source} disabled={busy || picking}
                selected={!cover && selectedSource === item.source}
                onPress={() => { setCover(undefined); update("cover", item.key); }} />)}
              <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={cover ? "Đổi ảnh bìa" : "Chọn ảnh bìa (tối đa 5 MB)"} accessibilityState={{ disabled: busy || picking }} disabled={busy || picking}
                onPress={() => { void chooseCover(); }} style={({ pressed }) => [styles.coverOption, styles.coverAdd, pressed && styles.pressed]}>
                <ClayIcon name="fieldEdit" size={18} />
                <Text style={styles.coverAddText}>{picking ? "Đang mở…" : cover ? "Đổi ảnh" : "Tải ảnh lên"}</Text>
              </Pressable>
            </ScrollView>
          </View>
          <Details title="Lời nhắn cho nhóm" defaultOpen={!!form.description}>
            <ClayField label="Nội dung lời nhắn" icon="fieldEdit" value={form.description} onChangeText={value => update("description", value)} multiline maxLength={4700} editable={!busy} placeholder="Không bắt buộc" />
          </Details>
        </>
      )}

      <View style={styles.draftActions}>
        <Button label="Lưu bản nháp" accessibilityLabel="Lưu bản nháp chuyến đi" variant="text" compact icon="edit"
          disabled={busy || picking} loading={draft.busy} onPress={() => { void draft.save(form).then(setSaved); }} />
        {hasDraft && (
          <Button label="Bỏ bản nháp" accessibilityLabel="Bỏ bản nháp chuyến đi" variant="text" compact
            disabled={busy || picking} onPress={() => setDiscard(true)} />
        )}
      </View>
      {saved && !draft.error && <Feedback success message="Đã lưu bản nháp chuyến đi trên thiết bị." />}

      <LoadingOverlay visible={submitting && !created} title={uploading ? "Đang đặt ảnh bìa…" : "Đang tạo chuyến đi…"}
        message={uploading ? "Chuyến đi đã có, Wolfi đang treo ảnh bìa lên." : `Wolfi đang chuẩn bị không gian cho ${form.name.trim() || "chuyến đi"}.`} />
      {created && <DesignPopup kind="tripCreated" message={created.coverFailed ? "Đã tạo chuyến đi. Bạn có thể chọn lại ảnh bìa trong phần chỉnh sửa." : `${form.name.trim() || "Chuyến đi của bạn"} đã có không gian riêng để cả nhóm cùng lên kế hoạch.`}
        onPrimary={() => router.replace({ pathname: "/trip/[id]", params: { id: created.id, ...(created.coverFailed ? { cover: "failed" } : {}) } })}
        onClose={() => router.replace({ pathname: "/trip/[id]/edit", params: { id: created.id } })} />}
      <Sheet visible={showDestinations} title="Chọn điểm đến" onClose={() => setShowDestinations(false)}>
        {destinations.map(city => <Button key={city} label={city} variant="soft"
          onPress={() => { update("destination", city); setShowDestinations(false); }} />)}
      </Sheet>
      <Sheet visible={showMembers} title="Số thành viên dự kiến" onClose={() => setShowMembers(false)}>
        <Text style={typography.footnote}>Dùng để ước tính ngân sách mỗi người. Bạn vẫn mời thành viên sau khi tạo chuyến.</Text>
        <View style={styles.memberChips}>
          {memberChoices.map(value => <ClayChip key={value} label={value} accessibilityLabel={`${value} người`} selected={String(memberCount) === value} disabled={busy}
            onPress={() => { update("members", value); setShowMembers(false); }} />)}
        </View>
      </Sheet>
      <Sheet visible={showTimezones} title="Chọn múi giờ chuyến đi" onClose={() => setShowTimezones(false)}>
        {timezoneOptions.map(item => {
          const checked = timezone === item.value;
          return (
            <Pressable key={item.value} cssInterop={false} accessibilityRole="radio" accessibilityLabel={item.label}
              accessibilityState={{ checked, disabled: busy }} aria-checked={checked} disabled={busy}
              style={({ pressed }) => [styles.zoneOption, checked && styles.zoneSelected, pressed && styles.pressed]}
              onPress={() => { update("timezone", item.value); setShowTimezones(false); }}>
              <Text style={[typography.headline, styles.flex]}>{item.label}</Text>
              {checked && <DesignIcon name="check" size={18} tintColor={colors.teal} />}
            </Pressable>
          );
        })}
      </Sheet>
      <Sheet visible={discard} title="Bỏ bản nháp chuyến đi?" dismissible={!draft.busy} onClose={() => setDiscard(false)}>
        <Text style={typography.body}>Thông tin đang nhập và bản nháp trên thiết bị sẽ bị xóa.</Text>
        {draft.error && <Feedback message={draft.error} />}
        <Button label="Xác nhận bỏ bản nháp" variant="destructive" loading={draft.busy}
          onPress={() => { void discardDraft(); }} />
      </Sheet>
    </Screen>
  );
}

function SelectedMark({ size }: { size: number }) {
  return <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
    <ClayIcon name="checkWhite" size={12} />
  </LinearGradient>;
}

function CoverOption({ label, source, selected, disabled, onPress }: { label: string; source: number | { uri: string }; selected: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable cssInterop={false} accessibilityRole="radio" accessibilityLabel={`Ảnh bìa ${label}`} accessibilityState={{ checked: selected, disabled }} aria-checked={selected} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.coverOption, selected && styles.coverSelected, pressed && styles.pressed]}>
    <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
    {selected && <View style={styles.coverMark}><SelectedMark size={20} /></View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: -10 },
  stepItem: { flexDirection: "row", alignItems: "center" },
  step: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 6, paddingRight: 14, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.surface, ...shadows.glass },
  connector: { width: 28, height: 2, borderRadius: 1, marginHorizontal: 8, backgroundColor: colors.line },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F6FD" },
  stepNumberActive: { backgroundColor: "rgba(255,255,255,0.28)" },
  stepNumberText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: claySubtitle.color },
  stepLabel: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: claySubtitle.color },
  headline: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30, color: colors.ink },
  intro: { gap: 4 },
  lead: { ...typography.body, color: claySubtitle.color },
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.ink },
  block: { gap: 8 },
  dates: { flexDirection: "row", gap: 12 },
  destinationPicker: { width: 32, minHeight: 48, alignItems: "center", justifyContent: "center" },
  preview: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 84, paddingVertical: 10, paddingLeft: 10, paddingRight: 14, borderRadius: 26, backgroundColor: colors.tealSoft },
  previewImage: { width: 64, height: 64, borderRadius: 20 },
  previewTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.ink },
  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, columnGap: 12 },
  styleCard: { flexGrow: 1, flexBasis: "45%", minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: 12, borderRadius: 22, borderWidth: 2, borderColor: "transparent", backgroundColor: colors.surface, ...shadows.glass },
  styleLabel: { flex: 1, minWidth: 0, fontFamily: fonts.heading, fontSize: 15, lineHeight: 22, color: colors.ink },
  budgetCard: { gap: 6, paddingTop: 14, paddingBottom: 16, paddingHorizontal: 16, borderRadius: 28, backgroundColor: colors.surface, ...shadows.glass },
  budgetLabel: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: claySubtitle.color },
  coverScroll: { marginHorizontal: -24 },
  covers: { gap: 12, paddingHorizontal: 24 },
  coverOption: { width: 110, height: 70, borderRadius: 20, overflow: "hidden", backgroundColor: colors.tealSoft },
  coverSelected: { borderWidth: 3, borderColor: colors.blue },
  coverMark: { position: "absolute", top: 5, right: 5, borderRadius: 12, borderWidth: 2, borderColor: colors.surface },
  coverAdd: { alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.blue, backgroundColor: colors.surface },
  coverAddText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: colors.blue },
  memberChips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  zoneOption: {
    minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface,
  },
  zoneSelected: { backgroundColor: colors.tealSoft },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  draftActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 },
});
