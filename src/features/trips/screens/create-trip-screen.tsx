import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { useCreateTripRequest } from "../hooks/use-create-trip-request";
import { useLocalDraft } from "@/shared/storage/use-local-draft";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { MoneyField } from "@/shared/ui/money-field";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Heading, Notice, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { coverBody, coverProblem } from "../components/trip-cover";
import { emptyCreateDraft, isCreateDraft, money, type CreateDraft } from "../model/local-parity";
import { TIMEZONES } from "../model/timezones";
import { localTimestamp, parseDate } from "../utils";

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
  const [step, setStep] = useState<"info" | "details">("info");
  const [validation, setValidation] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset>();
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const busy = !command.ready || command.busy || draft.busy || !!command.pending || uploading;
  const timezone = form.timezone ?? "Asia/Ho_Chi_Minh";
  const update = (key: keyof CreateDraft, value: string) => { if (!busy) { setForm(old => ({ ...old, [key]: value })); setSaved(false); } };
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
  function goTo(next: "info" | "details") {
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
    const tripId = await command.start({
      ...info,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(budget ? { budget_amount: String(budget) } : {}),
    });
    if (tripId) await finish(tripId);
  }
  async function finish(tripId: string) {
    // The trip exists already; a failed cover upload must never block opening it.
    let coverFailed = false;
    if (cover) {
      setUploading(true);
      try { await api.trips.uploadCover(tripId, coverBody(cover)); }
      catch { coverFailed = true; }
      finally { setUploading(false); }
    }
    if (await draft.clear() && await command.acknowledge())
      router.replace({ pathname: "/trip/[id]", params: { id: tripId, ...(coverFailed ? { cover: "failed" } : {}) } });
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
      }
    } catch { setValidation("Không mở được thư viện ảnh. Hãy thử lại."); }
    finally { setPicking(false); }
  }
  if (!command.ready || command.pending) return <Screen title="Chuyến đi mới">
    <Heading title={command.pending?.tripId ? "Chuyến đi đã được tạo" : "Khôi phục yêu cầu tạo chuyến đi"} />
    {command.error && <Feedback message={command.error} />}
    {validation && <Feedback message={validation} />}
    {!command.ready ? <Button label="Thử đọc lại yêu cầu" loading={command.busy} onPress={() => { void command.load(); }} /> : <>
      <Text style={typography.headline}>{command.pending!.input.name}</Text>
      <Notice>{command.pending!.tripId ? "Yêu cầu đã hoàn tất. Mở chuyến đi để tiếp tục." : "Yêu cầu trước đã được lưu. Gửi lại yêu cầu này để kiểm tra kết quả; app sẽ không tạo thêm chuyến đi trùng."}</Notice>
      <Button label={command.pending!.tripId ? "Mở chuyến đi đã tạo" : "Gửi lại yêu cầu đã lưu"} loading={command.busy || draft.busy || uploading} onPress={() => { void (async () => { const tripId = await command.retry(); if (tripId) await finish(tripId); })(); }} />
    </>}
  </Screen>;
  return <Screen title="Chuyến đi mới" onBack={() => {
    if (command.busy || draft.busy) return;
    if (step === "details") goTo("info"); else if (router.canGoBack()) router.back(); else router.replace("/(tabs)/trips");
  }} footer={<Button label={step === "info" ? "Tiếp tục" : "Tạo chuyến đi"} disabled={busy || picking} loading={command.busy || uploading} onPress={() => { void submit(); }} />}>
    <Segments items={[{ value: "info", label: "1  Thông tin" }, { value: "details", label: "2  Ngân sách & ảnh" }]} value={step} onChange={value => goTo(value as "info" | "details")} />
    <Heading title={step === "info" ? "Hành trình bắt đầu từ một ý tưởng" : "Theo cách của bạn"} />
    {saved && !draft.error && <Feedback success message="Đã lưu bản nháp chuyến đi trên thiết bị." />}
    {validation && <Feedback message={validation} />}{command.error && <Feedback message={command.error} />}{draft.error && <Feedback message={draft.error} />}
    {step === "info" ? <>
      <FormField label="Tên chuyến đi" icon="trip" value={form.name} onChangeText={value => update("name", value)} placeholder="Ví dụ: Đà Nẵng 3N2Đ" maxLength={200} editable={!busy} />
      <DateTimeField label="Ngày đi" value={form.start} onChangeText={value => {
        update("start", value);
        const first = parseDate(value), last = parseDate(form.end);
        if (first && last && last < first) update("end", value);
      }} editable={!busy} />
      <DateTimeField label="Ngày về" value={form.end} minimum={parseDate(form.start) ? form.start : undefined} onChangeText={value => update("end", value)} editable={!busy} />
      <Text style={typography.footnote}>Múi giờ chuyến đi</Text>
      <Segments scroll value={timezone} onChange={value => update("timezone", value)} items={TIMEZONES} />
      <Text style={typography.footnote}>Có thể đổi ngày đi, ngày về sau khi tạo.</Text>
    </> : <>
      <FormField label="Lời nhắn cho nhóm" icon="edit" value={form.description} onChangeText={value => update("description", value)} multiline maxLength={5000} editable={!busy} />
      <MoneyField label="Ngân sách dự kiến (VND)" value={form.budget} onChangeText={value => update("budget", value)} maxDigits={12} editable={!busy} />
      <Text style={typography.footnote}>Ngân sách lưu cùng chuyến đi và được điền sẵn khi bật quỹ nhóm. Có thể để trống.</Text>
      <Text style={typography.headline}>Ảnh bìa</Text>
      <Image source={cover ? { uri: cover.uri } : designAssets.tripCover} style={{ width: "100%", height: 180, borderRadius: 24 }} contentFit="cover" accessibilityLabel="Ảnh bìa chuyến đi" />
      <View style={[ui.row, { flexWrap: "wrap" }]}>
        <Button label={cover ? "Đổi ảnh bìa" : "Chọn ảnh bìa (tối đa 5 MB)"} variant="soft" compact loading={picking} disabled={busy} onPress={() => { void chooseCover(); }} />
        {cover && <Button label="Dùng ảnh mặc định" variant="text" compact disabled={busy} onPress={() => setCover(undefined)} />}
      </View>
    </>}
    <Button label="Lưu bản nháp chuyến đi" variant="soft" disabled={busy || picking} loading={draft.busy} onPress={() => { void draft.save(form).then(setSaved); }} />
    <Button label="Bỏ bản nháp chuyến đi" variant="destructive" disabled={command.busy || draft.busy} onPress={() => setDiscard(true)} />
    <Sheet visible={discard} title="Bỏ bản nháp chuyến đi?" dismissible={!draft.busy} onClose={() => setDiscard(false)}>
      <Text style={typography.body}>Thông tin nháp trên thiết bị sẽ bị xóa. Chuyến đi đã tạo không bị ảnh hưởng.</Text>
      {draft.error && <Feedback message={draft.error} />}
      <Button label="Xác nhận bỏ bản nháp" variant="destructive" loading={draft.busy} onPress={() => { void (async () => {
        if (await draft.clear()) { setForm({ ...emptyCreateDraft }); setCover(undefined); setSaved(false); setDiscard(false); setStep("info"); setValidation(undefined); }
      })(); }} />
    </Sheet>
  </Screen>;
}
