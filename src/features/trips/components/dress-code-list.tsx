import { useState } from "react";
import { Text, View } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Notice, Segments, ui } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import type { useTrip } from "../hooks/use-trip";
import { dressCodeForm, dressCodeInput, dressDayLabel, dressScopeLabel, dressScopes, DRESS_LABEL_MAX, type DressCodeForm } from "../model/dress-code";
import type { DressCode, Plan } from "../types";

type TripApi = ReturnType<typeof useTrip>["api"];
type Props = { api: TripApi; tripId: string; plan: Plan; days: string[]; scope: string; reload: () => Promise<unknown> | void };

/** Dress codes saved on the server and shared with the whole group (FR-PL03). */
export function DressCodeList({ api, tripId, plan, days, scope, reload }: Props) {
  const command = useCommand();
  const [form, setForm] = useState<DressCodeForm>();
  const [formError, setFormError] = useState<string>();
  const [deleting, setDeleting] = useState<DressCode>();
  const [saved, setSaved] = useState<string>();
  const editable = plan.permissions.can_edit;
  const visible = plan.dress_codes.filter(code => scope === "ALL" || code.scope_type === scope);

  function open(code?: DressCode) {
    command.clearError();
    setFormError(undefined);
    setSaved(undefined);
    setForm(dressCodeForm(code, days, plan.activities));
  }
  /** Editing a field clears the previous validation message. */
  function change(next: DressCodeForm) {
    setFormError(undefined);
    setForm(next);
  }
  async function submit() {
    if (!form) return;
    const result = dressCodeInput(form, { planVersion: plan.plan_version, days, activities: plan.activities });
    if ("error" in result) { setFormError(result.error); return; }
    setFormError(undefined);
    const done = await command.run({ dressCodeId: form.id, ...result.input }, key => api.trips.saveDressCode(tripId, form.id, result.input, key));
    if (!done) return;
    setForm(undefined);
    setSaved(form.id ? "Đã lưu thay đổi cho cả nhóm." : "Đã thêm dress code cho cả nhóm.");
    await reload();
  }
  async function remove() {
    if (!deleting) return;
    const done = await command.run({ remove: deleting.id, version: plan.plan_version }, key => api.trips.removeDressCode(tripId, deleting.id, plan.plan_version, key));
    if (!done) return;
    setDeleting(undefined);
    setSaved("Đã xóa dress code.");
    await reload();
  }
  const failure = command.error && <>
    <Feedback message={command.error} />
    <Button label="Tải kế hoạch mới nhất" variant="soft" compact onPress={() => { command.clearError(); setForm(undefined); setDeleting(undefined); void reload(); }} />
  </>;

  return <>
    {saved && <Feedback success message={saved} />}
    {editable
      ? <Button label="Thêm dress code" icon="plus" disabled={command.busy} onPress={() => open()} />
      : <Notice>Bạn có quyền xem. Quyền chỉnh sửa do người tổ chức quản lý.</Notice>}
    {visible.map(code => <View key={code.id} style={ui.record}>
      <Text style={[typography.footnote, { color: colors.tealPressed }]}>{dressScopeLabel(code, plan.activities)}</Text>
      <Text accessibilityRole="header" style={typography.section}>{code.label}</Text>
      {!!code.description && <Text style={typography.body}>{code.description}</Text>}
      {editable && <View style={[ui.row, { flexWrap: "wrap" }]}>
        <Button compact variant="soft" label="Sửa" accessibilityLabel={`Sửa ${code.label}`} disabled={command.busy} onPress={() => open(code)} />
        <Button compact variant="destructive" label="Xóa" accessibilityLabel={`Xóa ${code.label}`} disabled={command.busy} onPress={() => { command.clearError(); setSaved(undefined); setDeleting(code); }} />
      </View>}
    </View>)}
    {!visible.length && <EmptyState icon="shirt"
      title={plan.dress_codes.length ? "Chưa có dress code ở phạm vi này" : "Chưa có dress code"}
      message={plan.dress_codes.length ? "Chọn phạm vi khác để xem các hướng dẫn đã lưu." : editable ? "Thêm một gợi ý trang phục để cả nhóm cùng chuẩn bị." : "Hướng dẫn trang phục của nhóm sẽ xuất hiện tại đây."} />}

    <Sheet visible={!!form} title={form?.id ? "Sửa dress code" : "Thêm dress code"} dismissible={!command.busy} onClose={() => setForm(undefined)}>
      {form && <>
        <FormField label="Tên dress code" icon="edit" value={form.label} maxLength={DRESS_LABEL_MAX} editable={!command.busy} placeholder="Ví dụ: Trắng bên biển" onChangeText={label => change({ ...form, label })} />
        <View style={ui.stack}>
          <Text style={typography.headline}>Áp dụng</Text>
          <Segments scroll value={form.scope} items={dressScopes} onChange={value => { if (!command.busy) change({ ...form, scope: value }); }} />
        </View>
        {form.scope === "DAY" && <View style={ui.stack}>
          <Text style={typography.headline}>Ngày áp dụng</Text>
          <Segments scroll value={form.date} items={days.map(value => ({ value, label: dressDayLabel(value) }))} onChange={date => { if (!command.busy) change({ ...form, date }); }} />
        </View>}
        {form.scope === "ACTIVITY" && <View style={ui.stack}>
          <Text style={typography.headline}>Hoạt động áp dụng</Text>
          {plan.activities.length
            ? <Segments scroll value={form.activity} items={plan.activities.map(item => ({ value: item.id, label: item.title }))} onChange={activity => { if (!command.busy) change({ ...form, activity }); }} />
            : <Text style={typography.footnote}>Chưa có hoạt động nào trong lịch trình.</Text>}
        </View>}
        <FormField label="Mô tả trang phục" icon="edit" value={form.description} multiline maxLength={5000} editable={!command.busy} placeholder="Màu sắc, kiểu đồ, lưu ý…" onChangeText={description => change({ ...form, description })} />
        {formError && <Feedback message={formError} />}
        {failure}
        <Button label={form.id ? "Lưu thay đổi" : "Thêm cho cả nhóm"} loading={command.busy} onPress={() => { void submit(); }} />
      </>}
    </Sheet>
    <Sheet visible={!!deleting} title="Xóa dress code?" dismissible={!command.busy} onClose={() => setDeleting(undefined)}>
      <Text style={typography.body}>“{deleting?.label}” sẽ bị xóa khỏi kế hoạch chung của cả nhóm.</Text>
      {failure}
      <Button label="Xóa dress code" variant="destructive" loading={command.busy} onPress={() => { void remove(); }} />
    </Sheet>
  </>;
}
