import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { errorMessage } from "@/shared/api/errors";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { ClayChip, ClayDateField, ClayField, ClaySelect } from "@/shared/ui/clay-form";
import { Dialog } from "@/shared/ui/dialog";
import { DesignPopup } from "@/shared/ui/design-popup";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState, ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { ClayButton, ClayIcon } from "@/shared/ui/setting-card";
import { Sheet } from "@/shared/ui/sheet";
import { collectPages } from "../api/pagination";
import { useTrip } from "../hooks/use-trip";
import { memberName } from "../model/member-name";
import { CATEGORY_MAX, PACKING_UNITS, normalizeCategory, packingForm, packingInput, tripCategories, type PackingForm } from "../model/packing";
import type { Membership, PackingItem } from "../types";

export default function PackingItemScreen() {
  const resource = useTrip(), { id, api, data } = resource;
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const members = useResource(useCallback((signal: AbortSignal) => collectPages(cursor => api.trips.members(id, cursor, signal), signal), [id, api]));
  const [edition, setEdition] = useState(0);
  const item = data?.plan.packing_items.find(p => p.id === itemId);
  if (!data || !members.data) return <Screen title="Vật dụng"><ResourceFeedback {...resource} hasData={!!data} onRetry={resource.reload} /><ResourceFeedback {...members} hasData={!!members.data} onRetry={members.reload} /></Screen>;
  if (!data.plan.permissions.can_edit || (itemId && !item)) return <Screen title="Vật dụng"><EmptyState icon="bag" title={itemId && !item ? "Vật dụng đã được gỡ" : "Danh sách chỉ xem"} message="Quay lại hành lý để xem danh sách hiện tại." /></Screen>;
  return <ItemForm key={`${itemId ?? "new"}:${edition}`} resource={resource} members={members.data} item={item} onRefresh={() => { void resource.reload().then(latest => { if (latest) setEdition(n => n + 1); }); }} />;
}

function ItemForm({ resource, item, members, onRefresh }: { resource: ReturnType<typeof useTrip>; item?: PackingItem; members: Membership[]; onRefresh(): void }) {
  const { id, api, data } = resource, { plan, trip } = data!;
  const { width, fontScale } = useWindowDimensions();
  const stackFields = width / Math.max(1, fontScale) < 360;
  const command = useCommand();
  const [base] = useState(plan.plan_version);
  const [form, setForm] = useState(() => packingForm(item, trip.timezone));
  const [picker, setPicker] = useState<"category" | "unit" | "member">();
  const [custom, setCustom] = useState<string>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<PackingItem>();
  const [deleting, setDeleting] = useState(false);
  const stale = base !== plan.plan_version;
  const blocked = command.busy || !!saved || stale || resource.loading || !!resource.error;
  const categories = tripCategories(plan.packing_items);
  const assignees = members.filter(m => !m.left_at);
  const who = (m: Membership) => m.id === trip.current_membership.id ? memberName(m) + " · Tôi" : memberName(m);
  const selectedMember = assignees.find(m => m.id === form.assignee);
  const memberOptions = [{ value: "", label: "Cả nhóm" }, ...assignees.map(member => ({ value: member.id, label: who(member) }))];
  const pickerField = picker === "category" ? "category" : picker === "unit" ? "unit" : "assignee";
  const choices = picker === "member" ? memberOptions : (picker === "category" ? categories : PACKING_UNITS).map(value => ({ value, label: value }));
  const change = (key: keyof PackingForm, value: string) => { setError(undefined); setForm(current => ({ ...current, [key]: value })); };
  const leave = () => router.dismissTo({ pathname: "/trip/[id]/packing", params: { id } });
  async function save() {
    if (blocked) return;
    try {
      const category = custom === undefined ? form.category : normalizeCategory(custom, categories);
      const input = packingInput({ ...form, category }, { members, timezone: trip.timezone, planVersion: base });
      const result = await command.run({ itemId: item?.id, ...input }, key => api.trips.savePacking(id, item?.id, input, key));
      if (result) setSaved(result);
    } catch (cause) { setError(errorMessage(cause)); }
  }
  function continueEditing() {
    if (!saved) return;
    if (saved.id !== item?.id) router.replace({ pathname: "/trip/[id]/packing-item", params: { id, itemId: saved.id } });
    else { setSaved(undefined); onRefresh(); }
  }
  return <Screen clay title={item ? "Sửa vật dụng" : "Thêm vật dụng"} onBack={leave} footer={<View style={styles.row}>
    <View style={{ width: "34%" }}><ClayButton label="Hủy" tone="secondary" disabled={command.busy} onPress={leave} /></View>
    <View style={styles.flex}><ClayButton label={item ? "Lưu thay đổi" : "Thêm vào danh sách"} disabled={blocked} loading={command.busy} onPress={() => { void save(); }} /></View></View>}>
    <View style={{ gap: 4 }}><Text accessibilityRole="header" style={typography.title}>Nhớ mang theo…</Text>
      <Text style={typography.footnote}>Phân công để cả nhóm cùng sẵn sàng.</Text></View>
    <ClayField label="Tên vật dụng" icon="packingBag" placeholder="Ví dụ: Kem chống nắng" maxLength={200} value={form.name} editable={!command.busy} onChangeText={v => change("name", v)} />
    <View style={stackFields ? styles.stack : styles.row}><View style={stackFields ? undefined : styles.flex}><ClaySelect label="Danh mục" icon="packingTag" tone="butter" value={custom ?? form.category} onPress={() => setPicker("category")} /></View>
      <View style={stackFields ? undefined : styles.flex}><ClayField label="Số lượng" icon="packingQuantity" tone="mint" value={form.quantity} keyboardType="decimal-pad" inputMode="decimal" maxLength={11}
        onChangeText={v => change("quantity", v)} trailing={<Pressable accessibilityRole="button" accessibilityLabel="Chọn đơn vị" onPress={() => setPicker("unit")} style={styles.unit}><Text numberOfLines={1} style={typography.footnote}>{form.unit || "Đơn vị"}</Text></Pressable>} /></View></View>
    {custom !== undefined && <ClayField label="Tên danh mục mới" icon="packingTag" value={custom} maxLength={CATEGORY_MAX} onChangeText={v => { setCustom(v); setError(undefined); }} />}
    <ClaySelect label="Người chuẩn bị" icon="fieldUser" tone="lilac" value={selectedMember ? who(selectedMember) : form.assignee ? "Thành viên đã rời" : "Cả nhóm"} onPress={() => setPicker("member")} />
    <ClayDateField label="Hạn chuẩn bị" value={form.due} onChangeText={v => change("due", v)} />
    {!!form.due && <Button variant="text" compact label="Bỏ hạn chuẩn bị" onPress={() => change("due", "")} />}
    <ClayField label="Ghi chú" icon="fieldNote" tone="peach" value={form.note} maxLength={5000} placeholder="Ví dụ: SPF 50, dùng khi đi biển" multiline onChangeText={v => change("note", v)} />
    <View style={styles.tip}><ClayIcon name="info" size={18} /><Text style={[typography.footnote, styles.flex]}>Những món dùng chung chỉ cần một người nhận chuẩn bị.</Text></View>
    {(error || command.error || resource.error) && <Feedback inline message={error || command.error || resource.error!} />}
    {(stale || command.error || resource.error) && !saved && <><Text style={typography.footnote}>Tải lại để dùng danh sách mới nhất của nhóm.</Text><Button label="Tải kế hoạch mới nhất" variant="soft" onPress={onRefresh} /></>}
    {item && <Button variant="text" label="Xóa vật dụng này" disabled={blocked} onPress={() => { command.clearError(); setDeleting(true); }} />}
    <Sheet visible={!!picker} title={picker === "member" ? "Người chuẩn bị" : picker === "category" ? "Danh mục" : "Đơn vị"} onClose={() => setPicker(undefined)}>
      {picker === "unit" && <ClayField label="Đơn vị" icon="packingQuantity" value={form.unit} maxLength={30} onChangeText={v => change("unit", v)} />}
      <View style={styles.choices}>{choices.map(({ value, label }) => <ClayChip key={value} label={label}
        selected={value === form[pickerField] && (picker !== "category" || custom === undefined)}
        onPress={() => { if (picker === "category") setCustom(undefined); change(pickerField, value); setPicker(undefined); }} />)}</View>
      {picker === "category" && <Button label="Thêm danh mục mới" variant="soft" onPress={() => { setCustom(custom ?? ""); setPicker(undefined); }} />}
      {picker === "unit" && <Button label="Xong" onPress={() => setPicker(undefined)} />}
    </Sheet>
    {saved && <DesignPopup kind="packing" message="Tiếp tục chuẩn bị và đánh dấu các món đồ đã sẵn sàng." onPrimary={leave} onClose={continueEditing} />}
    <Dialog visible={deleting} kind="confirm" icon="deleted" title="Xóa vật dụng?" message={`Xóa “${item?.name}” khỏi danh sách chung của cả nhóm.`} onClose={() => setDeleting(false)} dismissible={!command.busy}>
      {command.error && <Feedback inline message={command.error} />}
      <Button label="Xóa vật dụng" variant="destructive" disabled={blocked} loading={command.busy} onPress={async () => {
        if (!item || blocked) return;
        if (await command.run({ remove: item.id, base }, key => api.trips.removePacking(id, item.id, base, key))) leave();
      }} /><Button label="Giữ lại" variant="soft" disabled={command.busy} onPress={() => setDeleting(false)} />
    </Dialog>
  </Screen>;
}
const styles = StyleSheet.create({
  stack: { gap: 18 },
  flex: { flex: 1, minWidth: 0 }, row: { flexDirection: "row", gap: 10 }, choices: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  unit: { maxWidth: 53, minHeight: 44, justifyContent: "center" }, tip: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, padding: 14, backgroundColor: colors.tealSoft },
});
