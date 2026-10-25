import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { useLocalDraft } from "@/shared/storage/use-local-draft";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Heading, Notice, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { emptyCreateDraft, isCreateDraft, money, moneyLabel, type CreateDraft } from "../model/local-parity";
import { localTimestamp, parseDate } from "../utils";

export default function CreateTripScreen() {
  const { idea } = useLocalSearchParams<{ idea?: string }>();
  const { profile } = useSession();
  const draft = useLocalDraft("new-trip", "create", isCreateDraft);
  if (!draft.ready) return <Screen title="Chuyến đi mới"><Notice>{draft.error ?? "Đang khôi phục bản nháp…"}</Notice>{draft.error && <Button label="Xóa bản nháp không đọc được" loading={draft.busy} onPress={() => { void draft.clear(); }} />}</Screen>;
  return <CreateTripForm key={profile?.id} initial={draft.value ?? { ...emptyCreateDraft, name: idea ?? "" }} draft={draft} />;
}

function CreateTripForm({ initial, draft }: { initial: CreateDraft; draft: ReturnType<typeof useLocalDraft<CreateDraft>> }) {
  const api = useApi(), command = useCommand();
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState<"info" | "details">("info");
  const [validation, setValidation] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [coverUri, setCoverUri] = useState<string>();
  const [createdId, setCreatedId] = useState<string>();
  const [picking, setPicking] = useState(false);
  const busy = command.busy || draft.busy || !!createdId;
  const timezone = "Asia/Ho_Chi_Minh";
  const update = (key: keyof CreateDraft, value: string) => { if (!busy) { setForm(old => ({ ...old, [key]: value })); setSaved(false); } };
  function valid() {
    if (!form.name.trim() || form.name.trim().length > 200) { setValidation("Tên chuyến đi cần từ 1 đến 200 ký tự."); return; }
    const first = parseDate(form.start), last = parseDate(form.end);
    if (!first || !last) { setValidation("Nhập ngày hợp lệ theo định dạng DD/MM/YYYY."); return; }
    if (last < first) { setValidation("Ngày về cần bằng hoặc sau ngày khởi hành."); return; }
    if (!/^[1-6]$/.test(form.members)) { setValidation("Số người dự kiến từ 1 đến 6."); return; }
    if (form.budget && !money(form.budget)) { setValidation("Ngân sách là số nguyên VND lớn hơn 0, tối đa 12 chữ số."); return; }
    setValidation(undefined);
    // Extra planning preferences remain local; do not invent unsupported API fields.
    return { name: form.name.trim(), start_at: localTimestamp(first, "00:00", timezone)!, end_at: localTimestamp(last, "23:59", timezone)!, timezone, ...(form.description.trim() ? { description: form.description.trim() } : {}) };
  }
  async function submit() {
    if (busy) return;
    const input = valid();
    if (!input) return;
    if (step === "info") { setStep("details"); return; }
    const trip = await command.run(input, key => api.trips.create(input, key));
    if (trip) {
      setCreatedId(trip.id);
      if (await draft.clear()) router.replace({ pathname: "/trip/[id]", params: { id: trip.id } });
      else setValidation("Chuyến đi đã tạo thành công nhưng chưa xóa được bản nháp. Không bấm tạo lại.");
    }
  }
  async function chooseCover() {
    if (busy || picking) return;
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: false });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (!asset.fileSize || asset.fileSize > 5 * 1024 * 1024) { setValidation("Chọn ảnh có kích thước xác định, tối đa 5 MB."); return; }
        setCoverUri(asset.uri);
      }
    } catch { setValidation("Không mở được thư viện ảnh. Hãy thử lại."); }
    finally { setPicking(false); }
  }
  return <Screen title="Chuyến đi mới" onBack={() => {
    if (command.busy || draft.busy) return;
    if (step === "details") setStep("info"); else if (router.canGoBack()) router.back(); else router.replace("/(tabs)/trips");
  }} footer={<Button label={step === "info" ? "Tiếp tục" : "Tạo chuyến đi"} disabled={busy || picking} loading={command.busy} onPress={() => { void submit(); }} />}>
    <Segments items={[{ value: "info", label: "1  Thông tin" }, { value: "details", label: "2  Cá nhân hóa" }]} value={step} onChange={value => { if (!busy && (value === "info" || valid())) setStep(value); }} />
    <Heading title={step === "info" ? "Hành trình bắt đầu từ một ý tưởng" : "Theo cách của bạn"} />
    {draft.value && <Notice>Có bản nháp trên thiết bị cho tài khoản này. Bấm Lưu bản nháp chuyến đi để giữ các thay đổi mới.</Notice>}
    {saved && !draft.error && <Feedback success message="Đã lưu bản nháp chuyến đi trên thiết bị." />}
    {validation && <Feedback message={validation} />}{command.error && <Feedback message={command.error} />}{draft.error && <Feedback message={draft.error} />}
    {createdId && <Button label="Mở chuyến đi đã tạo" onPress={() => router.replace({ pathname: "/trip/[id]", params: { id: createdId } })} />}
    {step === "info" ? <>
      <FormField label="Tên chuyến đi" icon="trip" value={form.name} onChangeText={value => update("name", value)} placeholder="Ví dụ: Đà Nẵng 3N2Đ" maxLength={200} editable={!busy} />
      <FormField label="Điểm đến dự kiến (nháp)" icon="pin" value={form.destination} onChangeText={value => update("destination", value)} maxLength={200} editable={!busy} />
      <View style={[ui.row, { flexWrap: "wrap" }]}>{["Đà Nẵng", "Đà Lạt", "Phú Quốc"].map(value => <Button key={value} label={value} compact variant="soft" disabled={busy} onPress={() => { update("destination", value); if (!form.name) update("name", "Khám phá " + value); }} />)}</View>
      <DateTimeField label="Ngày đi" value={form.start} onChangeText={value => update("start", value)} editable={!busy} />
      <DateTimeField label="Ngày về" value={form.end} onChangeText={value => update("end", value)} editable={!busy} />
      <Text style={typography.footnote}>Giờ Việt Nam · UTC+7. Bạn sẽ mời bạn đồng hành sau khi tạo chuyến đi.</Text>
    </> : <>
      <FormField label="Lời nhắn cho nhóm" icon="edit" value={form.description} onChangeText={value => update("description", value)} multiline maxLength={5000} editable={!busy} />
      <Notice>Điểm đến, số người, ngân sách, phong cách, mẫu và ảnh dưới đây chỉ dùng để phác thảo. Khi tạo chuyến đi, máy chủ chỉ nhận tên, ngày và lời nhắn.</Notice>
      <FormField label="Số người dự kiến (1–6)" icon="users" value={form.members} onChangeText={value => update("members", value)} keyboardType="number-pad" maxLength={1} editable={!busy} />
      <FormField label="Ngân sách dự kiến (VND)" icon="wallet" value={form.budget} onChangeText={value => update("budget", value)} keyboardType="number-pad" maxLength={12} editable={!busy} />
      {money(form.budget) && /^[1-6]$/.test(form.members) ? <Text style={typography.headline}>Khoảng {moneyLabel(Number(form.budget) / Number(form.members))} / người</Text> : null}
      <Text style={typography.headline}>Phong cách dự kiến</Text>
      <Segments scroll value={form.style} onChange={value => update("style", value)} items={[{ value: "explore", label: "Khám phá" }, { value: "relax", label: "Nghỉ dưỡng" }, { value: "food", label: "Ẩm thực" }, { value: "culture", label: "Văn hóa" }]} />
      <Text style={typography.headline}>Mẫu dự kiến (không tự tạo hoạt động)</Text>
      <Segments scroll value={form.template} onChange={value => update("template", value)} items={[{ value: "blank", label: "Trống" }, { value: "balanced", label: "Cân bằng" }, { value: "discovery", label: "Khám phá" }]} />
      <Text style={typography.headline}>Ảnh bìa xem trước</Text>
      <Segments scroll value={form.cover} onChange={value => { if (!busy) { setCoverUri(undefined); update("cover", value); } }} items={[{ value: "tripCover", label: "Đà Nẵng" }, { value: "dalat", label: "Đà Lạt" }, { value: "coast", label: "Biển" }]} />
      <Button label="Chọn ảnh bìa (tối đa 5 MB)" variant="soft" loading={picking} disabled={busy} onPress={() => { void chooseCover(); }} />
      <Text style={typography.footnote}>Ảnh chọn từ máy chỉ xem trước trong phiên này, không tải lên và không lưu cùng bản nháp.</Text>
      <View style={ui.card}><Text style={typography.headline}>{form.name}</Text><Text style={typography.body}>{form.start} – {form.end}</Text></View>
    </>}
    <Image source={coverUri ? { uri: coverUri } : form.cover === "dalat" ? designAssets.dalat : form.cover === "coast" ? designAssets.coast : designAssets.tripCover} style={{ width: "100%", height: 180, borderRadius: 24 }} contentFit="cover" />
    <Button label="Lưu bản nháp chuyến đi" variant="soft" disabled={busy || picking} loading={draft.busy} onPress={() => { void draft.save(form).then(setSaved); }} />
    <Button label="Bỏ bản nháp chuyến đi" variant="destructive" disabled={command.busy || draft.busy} onPress={() => setDiscard(true)} />
    <Sheet visible={discard} title="Bỏ bản nháp chuyến đi?" dismissible={!draft.busy} onClose={() => setDiscard(false)}>
      <Text style={typography.body}>Thông tin nháp trên thiết bị sẽ bị xóa. Chuyến đi đã tạo không bị ảnh hưởng.</Text>
      {draft.error && <Feedback message={draft.error} />}
      <Button label="Xác nhận bỏ bản nháp" variant="destructive" loading={draft.busy} onPress={() => { void (async () => {
        if (await draft.clear()) { setForm({ ...emptyCreateDraft }); setCoverUri(undefined); setSaved(false); setDiscard(false); setStep("info"); setValidation(undefined); }
      })(); }} />
    </Sheet>
  </Screen>;
}
