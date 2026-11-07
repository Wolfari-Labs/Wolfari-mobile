import { useCallback, useState } from "react";
import { Switch, Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { errorMessage } from "@/shared/api/errors";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Heading, Notice, ResourceFeedback, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { notificationGroups, type GroupOverride, type NotificationGroup, type NotificationPreferences } from "./api";
import { pushSupported, registerPushDevice, type PushStatus } from "./push";
import { useSession } from "@/features/auth/session/session-provider";

const groupLabels: Record<NotificationGroup, string> = {
  INVITATION: "Lời mời chuyến đi", PLAN: "Lịch trình", PACKING: "Hành lý",
  CONTRIBUTION: "Đóng góp quỹ", CLOSURE: "Chốt quỹ", PRICE: "Theo dõi giá vé",
};

function Toggle({ label, value, disabled, onChange }: { label: string; value: boolean; disabled?: boolean; onChange(value: boolean): void }) {
  return <View style={[ui.row, { minHeight: 44 }]}>
    <Text style={[typography.body, ui.flex, disabled && { color: colors.muted }]}>{label}</Text>
    <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: colors.teal, false: colors.line }} />
  </View>;
}

export default function NotificationPreferencesScreen() {
  const api = useApi();
  const { profile } = useSession();
  const [push, setPush] = useState<PushStatus>();
  const resource = useResource(useCallback((signal: AbortSignal) => api.notifications.preferences(signal), [api]));
  // Local edits belong to the server snapshot they started from; a fresh load replaces them.
  const [edit, setEdit] = useState<{ base: NotificationPreferences | undefined; value: NotificationPreferences }>();
  const draft = edit && edit.base === resource.data ? edit.value : resource.data;
  const setDraft = (update: (old: NotificationPreferences | undefined) => NotificationPreferences | undefined) => {
    const value = update(draft);
    setEdit(value ? { base: resource.data, value } : undefined);
  };
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const change = (patch: Partial<NotificationPreferences>) => { setDraft(old => old && { ...old, ...patch }); setSaved(false); };
  const groupOn = (group: NotificationGroup, channel: keyof GroupOverride) => draft?.group_overrides[group]?.[channel] ?? true;
  // Store only "off" overrides; an empty group object is rejected by the backend.
  function setGroup(group: NotificationGroup, channel: keyof GroupOverride, on: boolean) {
    if (!draft) return;
    const overrides = { ...draft.group_overrides };
    const rest: GroupOverride = { ...overrides[group] };
    if (on) delete rest[channel]; else rest[channel] = false;
    if (Object.keys(rest).length) overrides[group] = rest; else delete overrides[group];
    change({ group_overrides: overrides });
  }
  async function enablePush() {
    if (!profile?.id) return;
    const status = await registerPushDevice(api.notifications, profile.id, true);
    setPush(status);
    if (status === "registered" && draft && !draft.push_enabled) change({ push_enabled: true });
  }
  async function save() {
    if (!draft || busy) return;
    setBusy(true); setError(undefined);
    try { const next = await api.notifications.updatePreferences(draft); setDraft(() => next); setSaved(true); }
    catch (cause) { setError(errorMessage(cause)); await resource.reload(); }
    finally { setBusy(false); }
  }
  return <Screen title="Cài đặt thông báo">
    <Heading title="Cài đặt thông báo" subtitle="Chọn loại thông báo bạn muốn nhận qua thông báo đẩy và email." />
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
    {error && <Feedback message={error} />}
    {saved && <Feedback success message="Đã lưu cài đặt thông báo." />}
    {draft && <>
      <Toggle label="Thông báo đẩy trên điện thoại" value={draft.push_enabled} disabled={busy} onChange={value => change({ push_enabled: value })} />
      <Toggle label="Thông báo qua email" value={draft.email_enabled} disabled={busy} onChange={value => change({ email_enabled: value })} />
      {pushSupported()
        ? <Button label="Cho phép thông báo trên máy này" variant="soft" disabled={busy} onPress={() => { void enablePush(); }} />
        : <Notice>Expo Go và bản web không nhận được thông báo đẩy. Hãy cài bản development build (eas build --profile development) để thử.</Notice>}
      {push === "registered" && <Feedback success message="Đã đăng ký máy này để nhận thông báo đẩy." />}
      {push === "denied" && <Feedback message="Bạn chưa cho phép thông báo. Mở Cài đặt của điện thoại → Wolfari → Thông báo để bật." />}
      {push === "error" && <Feedback message="Chưa đăng ký được thông báo đẩy. Kiểm tra kết nối rồi thử lại." />}
      {notificationGroups.map(group => <View key={group} style={ui.stack}>
        <Text style={typography.headline}>{groupLabels[group]}</Text>
        <Toggle label="Đẩy" value={draft.push_enabled && groupOn(group, "push")} disabled={busy || !draft.push_enabled} onChange={value => setGroup(group, "push", value)} />
        <Toggle label="Email" value={draft.email_enabled && groupOn(group, "email")} disabled={busy || !draft.email_enabled} onChange={value => setGroup(group, "email", value)} />
      </View>)}
      <Notice>Thông báo trong app luôn hiển thị ở mục Thông báo.</Notice>
      <Button label="Lưu cài đặt" loading={busy} onPress={() => { void save(); }} />
    </>}
  </Screen>;
}
