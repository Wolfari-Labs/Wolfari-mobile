import { randomUUID } from "expo-crypto";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { useLocalDraft } from "@/shared/storage/use-local-draft";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Notice, Segments, ui } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { isCollection, type DraftRow } from "../model/local-parity";

export type DraftField = {
  key: string; label: string; placeholder?: string; numeric?: boolean; multiline?: boolean;
  options?: { value: string; label: string }[]; suggestions?: string[];
  visible?: (row: DraftRow) => boolean;
};
type Props = {
  scope: string; feature: string; title: string; fields: DraftField[]; initial: Record<string, string>;
  seed?: DraftRow[]; base?: string; editable: boolean; completable?: boolean;
  validate: (row: DraftRow) => string | undefined;
  render: (row: DraftRow) => ReactNode;
  summary?: (rows: DraftRow[]) => ReactNode;
  filter?: (row: DraftRow) => boolean;
  groupBy?: string;
  toggle?: { key: string; on: string; off: string; onLabel: string; offLabel: string };
  history?: boolean;
};
export function DraftCollection({ scope, feature, title, fields, initial, seed = [], base = "", editable, completable, validate, render, summary, filter, groupBy, toggle, history }: Props) {
  const draft = useLocalDraft(scope, feature, isCollection);
  const [editing, setEditing] = useState<DraftRow>();
  const [formError, setFormError] = useState<string>();
  const [deleting, setDeleting] = useState<DraftRow>();
  const [resetting, setResetting] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const rows = draft.value?.rows ?? seed;
  const stale = !!draft.value && draft.value.base !== base;
  const enabled = draft.ready && !draft.busy && !stale;
  async function saveRows(next: DraftRow[], action: string) {
    if (!enabled) return false;
    const ok = await draft.save({ base, rows: next, history: [new Date().toISOString() + " · " + action, ...(draft.value?.history ?? [])].slice(0, 100) });
    setSaved(ok);
    return ok;
  }
  async function submit() {
    if (!editing || !editable || !enabled) return;
    const error = validate(editing);
    if (error) { setFormError(error); return; }
    const next = rows.some(r => r.id === editing.id) ? rows.map(r => r.id === editing.id ? editing : r) : [...rows, editing];
    if (next.length > 500) { setFormError("Tối đa 500 mục trong một bản nháp."); return; }
    if (await saveRows(next, "Lưu " + (editing.name || editing.label || editing.origin || title))) setEditing(undefined);
  }
  const visible = rows.filter(row => !filter || filter(row));
  const groups = groupBy ? [...new Set(visible.map(row => row[groupBy] || "Khác"))] : [""];
  return <>
    <Notice>Bản nháp trên thiết bị · Riêng tài khoản này · Không đồng bộ với nhóm, tự hết hạn sau 30 ngày.</Notice>
    {!draft.ready && !draft.error && <Text style={typography.footnote}>Đang đọc bản nháp…</Text>}
    {draft.error && <Feedback message={draft.error} />}
    {stale && <Feedback message="Dữ liệu nhóm đã thay đổi. Bản nháp cũ được giữ để tham khảo; hãy bỏ bản nháp và bắt đầu từ dữ liệu mới trước khi chỉnh sửa." />}
    {saved && !draft.error && <Feedback success message="Đã lưu bản nháp trên thiết bị này." />}
    {summary?.(rows)}
    {editable && <Button label={"Thêm " + title} disabled={!enabled} onPress={() => { setFormError(undefined); setSaved(false); setEditing({ ...initial, id: randomUUID() }); }} />}
    {(draft.value || draft.error) && <Button label="Bỏ bản nháp trên thiết bị" compact variant="soft" disabled={draft.busy} onPress={() => setResetting(true)} />}
    {!editable && <Notice>Bạn có quyền xem. Quyền chỉnh sửa do người tổ chức quản lý.</Notice>}
    {history ? <>
      <Text style={typography.headline}>Lịch sử chỉnh sửa trên thiết bị</Text>
      {(draft.value?.history ?? []).map((event, i) => <Text key={i} style={typography.footnote}>{event}</Text>)}
      {!draft.value?.history.length && <EmptyState title="Chưa có lịch sử" message="Các thay đổi bản nháp xuất hiện tại đây." />}
    </> : groups.map(group => <View key={group} style={ui.stack}>
      {groupBy && <Button variant="soft" label={(collapsed.includes(group) ? "+ " : "− ") + group} onPress={() => setCollapsed(old => old.includes(group) ? old.filter(g => g !== group) : [...old, group])} />}
      {!collapsed.includes(group) && visible.filter(row => !groupBy || (row[groupBy] || "Khác") === group).map(row => <View key={row.id} style={ui.card}>
        {render(row)}
        {toggle && (completable ?? editable) && <Button compact variant="soft" disabled={!enabled} label={row[toggle.key] === toggle.on ? toggle.onLabel : toggle.offLabel} onPress={() => { void saveRows(rows.map(r => r.id === row.id ? { ...r, [toggle.key]: r[toggle.key] === toggle.on ? toggle.off : toggle.on } : r), "Đổi trạng thái " + (row.name || row.origin || title)); }} />}
        {editable && <View style={[ui.row, { flexWrap: "wrap" }]}>
          <Button compact variant="soft" disabled={!enabled} label="Sửa bản nháp" onPress={() => { setFormError(undefined); setEditing({ ...row }); }} />
          <Button compact variant="destructive" disabled={!enabled} label="Xóa khỏi bản nháp" onPress={() => setDeleting(row)} />
        </View>}
      </View>)}
    </View>)}
    {!history && !visible.length && <EmptyState title="Chưa có mục phù hợp" message="Thêm bản nháp mới hoặc đổi bộ lọc để xem các mục khác." />}
    <Sheet visible={!!editing} title={"Bản nháp " + title} dismissible={!draft.busy} onClose={() => setEditing(undefined)}>
      {editing && <>
        <Notice>Chỉ lưu trên thiết bị, không thay đổi kế hoạch chung.</Notice>
        {fields.filter(field => !field.visible || field.visible(editing)).map(field => <View key={field.key} style={ui.stack}>
          {field.options ? <><Text style={typography.headline}>{field.label}</Text><Segments scroll value={editing[field.key] ?? ""} items={field.options} onChange={value => { if (!draft.busy) setEditing({ ...editing, [field.key]: value }); }} /></> :
            <FormField label={field.label} icon="edit" value={editing[field.key] ?? ""} placeholder={field.placeholder} keyboardType={field.numeric ? "decimal-pad" : "default"} multiline={field.multiline} maxLength={field.multiline ? 5000 : 200} editable={!draft.busy} onChangeText={value => setEditing({ ...editing, [field.key]: value })} />}
          {field.suggestions && <View style={[ui.row, { flexWrap: "wrap" }]}>{field.suggestions.map(value => <Button key={value} compact variant="soft" label={value} disabled={draft.busy} onPress={() => setEditing({ ...editing, [field.key]: value })} />)}</View>}
        </View>)}
        {formError && <Feedback message={formError} />}
        {draft.error && <Feedback message={draft.error} />}
        {stale && <Feedback message="Dữ liệu nhóm đã đổi; đóng biểu mẫu và bỏ bản nháp cũ." />}
        <Button label="Lưu bản nháp" disabled={!enabled || !editable} loading={draft.busy} onPress={() => { void submit(); }} />
      </>}
    </Sheet>
    <Sheet visible={!!deleting || resetting} title="Bỏ dữ liệu bản nháp?" dismissible={!draft.busy} onClose={() => { setDeleting(undefined); setResetting(false); }}>
      <Text style={typography.body}>Chỉ bỏ bản nháp trên thiết bị. Dữ liệu chung của nhóm không bị thay đổi.</Text>
      {draft.error && <Feedback message={draft.error} />}
      <Button label="Xác nhận bỏ bản nháp" variant="destructive" loading={draft.busy} disabled={!resetting && (!enabled || !editable)} onPress={() => { void (async () => {
        const ok = resetting ? await draft.clear() : deleting && await saveRows(rows.filter(r => r.id !== deleting.id), "Xóa " + (deleting.name || deleting.origin || title));
        if (ok) { setDeleting(undefined); setResetting(false); setSaved(false); }
      })(); }} />
    </Sheet>
  </>;
}
