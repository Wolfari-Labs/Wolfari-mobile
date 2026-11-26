import { DesignPopup } from "@/shared/ui/design-popup";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/auth/session/session-provider";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { CardSection, ClayButton, ClayIcon, claySubtitle, SettingCard } from "@/shared/ui/setting-card";
import { Sheet } from "@/shared/ui/sheet";
import { toast } from "@/shared/ui/toast";
import { collectPages } from "../api/pagination";
import { coverFor } from "../components/trip-card";
import { TripCoverImage } from "../components/trip-cover";
import { useTrip } from "../hooks/use-trip";
import type { PlanPolicy, Trip } from "../types";
import { calendarLabel, dateKey, lastTripDay } from "../utils";
import { memberName, userNamer } from "../model/member-name";
import { isWaiting, REMINDER_LIMIT, tripReminderPlan, type TripReminderKind } from "../model/trip-reminder-plan";

export default function TripSettingsScreen() {
  const resource = useTrip();
  const { data, api, id } = resource;
  const command = useCommand();
  const [choice, setChoice] = useState<PlanPolicy>();
  const [selected, setSelected] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const owner = data?.trip.current_membership.role === "OWNER";
  const archived = data?.trip.lifecycle === "ARCHIVED";
  const policy = useResource(useCallback((signal: AbortSignal) => api.trips.getPolicy(id, signal), [api, id]), !!owner);
  const currentPolicy = policy.data?.policy ?? data?.trip.plan_edit_policy;
  const writable = owner && !archived && !resource.loading && !resource.error && !!policy.data && !policy.loading && !policy.error;
  const members = useResource(useCallback((signal: AbortSignal) => collectPages(cursor => api.trips.members(id, cursor, signal), signal), [api, id]));
  const fund = useResource(useCallback((signal: AbortSignal) => api.finance.fund(id, signal), [api, id]));
  const reminders = useResource(useCallback((signal: AbortSignal) => api.notifications.reminders(id, signal), [api, id]));
  const [reminderDraft, setReminderDraft] = useState<Partial<Record<TripReminderKind, boolean>>>({});
  const [picking, setPicking] = useState(false);
  const { profile } = useSession();
  const active = members.data?.filter(member => !member.left_at) ?? [];
  const eligible = active.filter(member => member.role !== "OWNER");
  const membersReady = !!members.data && !members.loading && !members.error;
  const shownPolicy = choice ?? currentPolicy;
  const selectedIds = choice === "SELECTED_MEMBERS" ? selected : policy.data?.editor_member_ids ?? [];

  function reminderState(kind: TripReminderKind) {
    const planned = data && reminders.data ? tripReminderPlan(kind, data.plan, data.trip.start_at, reminders.data) : undefined;
    const saved = !!planned?.available && !planned.missing.length;
    return { planned, saved, shown: reminderDraft[kind] ?? saved };
  }
  const packing = reminderState("PACKING"), activity = reminderState("ACTIVITY");
  const remindersReady = !archived && !!reminders.data && !reminders.loading && !reminders.error && !resource.loading && !resource.error;
  const changed = (Object.keys(reminderDraft) as TripReminderKind[]).filter(kind => reminderDraft[kind] !== (kind === "PACKING" ? packing : activity).saved);
  const dirty = !!choice || changed.length > 0;
  const policyReady = !choice || (writable && (choice !== "SELECTED_MEMBERS" || membersReady));
  const canSave = dirty && policyReady && (!changed.length || remindersReady) && !command.busy;

  async function reloadAll() {
    await Promise.all([resource.reload(), members.reload(), fund.reload(), reminders.reload(), ...(owner ? [policy.reload()] : [])]);
  }
  async function saveReminders() {
    if (!remindersReady) return false;
    const writes: (() => Promise<unknown>)[] = [];
    let waiting = reminders.data!.filter(isWaiting).length;
    for (const kind of changed) {
      const planned = (kind === "PACKING" ? packing : activity).planned!;
      if (reminderDraft[kind]) {
        waiting += planned.missing.length;
        for (const input of planned.missing) writes.push(() => command.run(input, key => api.notifications.createReminder(id, input, key)));
      } else {
        waiting -= planned.active.length;
        for (const row of planned.active) writes.unshift(() => command.run({ cancel: row.id }, () => api.notifications.cancelReminder(id, row.id)));
      }
    }
    if (waiting > REMINDER_LIMIT) {
      toast.warning(`Mỗi chuyến đi có tối đa ${REMINDER_LIMIT} lịch nhắc đang chờ. Hãy đặt riêng cho các hoạt động quan trọng.`);
      return false;
    }
    let complete = true;
    for (const write of writes) if (!await write()) { complete = false; break; }
    // Rows already written stay; reloading keeps the next save from creating them twice.
    await reminders.reload();
    if (complete) setReminderDraft({});
    return complete;
  }
  async function save() {
    if (!data || !canSave) return;
    setSuccess(false);
    if (choice) {
      const editors = choice === "SELECTED_MEMBERS" ? selected : [];
      if (editors.some(editor => !eligible.some(member => member.id === editor))) return;
      const revision = policy.data!.membership_revision;
      const result = await command.run({ policy: choice, editors, revision }, key => api.trips.policy({ ...data.trip, membership_revision: revision }, choice, editors, key));
      if (!result) return;
      setConfirm(false); setChoice(undefined); setSelected([]);
      await Promise.all([resource.reload(), policy.reload()]);
    }
    setConfirm(false);
    if (changed.length && !await saveReminders()) return;
    setSuccess(true);
  }
  function toggleGroup() {
    if (!writable || command.busy) return;
    const next: PlanPolicy = shownPolicy === "ALL_MEMBERS" ? "OWNER_ONLY" : "ALL_MEMBERS";
    setChoice(next === currentPolicy ? undefined : next);
    setSelected([]); setSuccess(false);
  }
  function openPicker() {
    setSelected([...selectedIds].filter(value => eligible.some(member => member.id === value)));
    setPicking(true); setSuccess(false);
  }
  const period = data ? shortPeriod(data.trip) : "";
  const who = userNamer(members.data, profile?.id ?? "");
  const holderId = fund.data?.holder_user_id;
  const manage = (action: "ARCHIVE" | "TRANSFER" | "DELETE") => router.push({ pathname: "/trip/[id]/manage", params: { id, action } });
  const policyNote = shownPolicy === "SELECTED_MEMBERS" ? "Một số thành viên được chọn đang có quyền sửa" : "Cho phép thành viên cập nhật kế hoạch";
  const reminderNote = (state: typeof packing, text: string, empty: string) => reminders.error ? "Chưa tải được lịch nhắc" : !reminders.data || state.planned?.available ? text : empty;

  return <Screen clay title="Cài đặt chuyến đi" onRefresh={() => { void reloadAll(); }} refreshing={(resource.loading || policy.loading) && !!data}
    footer={data && !archived ? <ClayButton label="Lưu cài đặt" loading={command.busy} disabled={!canSave} onPress={() => { if (choice === "SELECTED_MEMBERS") setConfirm(true); else void save(); }} /> : undefined}>
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <>
      <View style={styles.hero}>
        <TripCoverImage trip={data.trip} fallback={coverFor(data.trip)} style={styles.thumb} label={data.trip.name} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle} numberOfLines={2}>{data.trip.name}</Text>
          <Text style={claySubtitle}>{period}{members.data ? ` · ${active.length} người` : ""}</Text>
        </View>
        {data.trip.permissions.can_update && <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Chỉnh sửa thông tin" hitSlop={8}
          onPress={() => router.push({ pathname: "/trip/[id]/edit", params: { id } })} style={({ pressed }) => [styles.edit, pressed && { opacity: 0.7 }]}>
          <ClayIcon name="edit" size={14} /><Text style={styles.editText}>Sửa</Text>
        </Pressable>}
      </View>

      <CardSection title="Quyền trong nhóm">
        {owner && !archived ? <>
          <ResourceFeedback {...policy} hasData={!!policy.data} onRetry={() => { void policy.reload(); }} />
          <SettingCard icon="users" tone="blue" title="Cùng chỉnh sửa lịch" subtitle={policyNote} value={shownPolicy === "ALL_MEMBERS"} disabled={!writable || command.busy} onPress={toggleGroup} />
          {shownPolicy !== "ALL_MEMBERS" && <SettingCard icon="user" tone="lilac" title="Chọn thành viên" disabled={!writable || command.busy || !membersReady}
            subtitle={shownPolicy === "SELECTED_MEMBERS" ? `Được sửa: ${eligible.filter(member => selectedIds.includes(member.id)).map(member => memberName(member)).join(", ") || "Chỉ chủ nhóm"}` : "Chỉ cho một số người sửa lịch trình"} onPress={openPicker} />}
        </> : <SettingCard icon="users" tone="blue" title={policyTitles[currentPolicy ?? data.trip.plan_edit_policy]}
          subtitle={archived ? "Chuyến đi đã lưu trữ. Quyền của nhóm chỉ có thể xem." : "Người tổ chức quản lý quyền sửa kế hoạch của các thành viên."} />}
        <SettingCard icon="wallet" tone="mint" title="Người quản lý quỹ" subtitle={holderId ? `${members.data?.find(member => member.user_id === holderId)?.display_name?.trim() || who(holderId)}${holderId === profile?.id ? " · Bạn" : ""}` : fund.error ? "Chưa tải được thông tin quỹ" : fund.loading ? "Đang tải…" : "Chưa mở quỹ nhóm"}
          onPress={() => router.push({ pathname: "/trip/[id]/fund", params: { id } })} />
        {members.error && <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />}
      </CardSection>

      {!archived && <CardSection title="Nhắc trước chuyến đi">
        <SettingCard icon="bag" tone="butter" title="Nhắc chuẩn bị hành lý" subtitle={reminderNote(packing, "Trước ngày khởi hành 1 ngày", "Cần món hành lý có hạn chuẩn bị từ 1 ngày trước giờ đi")} value={packing.shown}
          disabled={!remindersReady || !packing.planned?.available || command.busy} onPress={() => { setSuccess(false); setReminderDraft(old => ({ ...old, PACKING: !packing.shown })); }} />
        <SettingCard icon="bell" tone="lilac" title="Nhắc hoạt động" subtitle={reminderNote(activity, "Trước mỗi hoạt động 30 phút", "Cần hoạt động sắp tới có giờ bắt đầu")} value={activity.shown}
          disabled={!remindersReady || !activity.planned?.available || command.busy} onPress={() => { setSuccess(false); setReminderDraft(old => ({ ...old, ACTIVITY: !activity.shown })); }} />
        <SettingCard icon="clock" tone="peach" title="Lịch nhắc của tôi" subtitle="Nhắc riêng cho hoạt động và hành lý" onPress={() => router.push({ pathname: "/trip/[id]/reminders", params: { id } })} />
      </CardSection>}
      {command.error && !confirm && <><Feedback message={command.error} /><Button label="Tải thông tin mới nhất" variant="soft" onPress={() => { setChoice(undefined); setSelected([]); setReminderDraft({}); command.clearError(); void reloadAll(); }} /></>}

      {(owner || !archived) && <CardSection title="Quản lý chuyến đi">
        {owner ? <>
          <SettingCard icon="archive" tone="slate" title={archived ? "Mở lại chuyến đi" : "Lưu trữ chuyến đi"} subtitle={archived ? "Cho nhóm tiếp tục chỉnh sửa" : "Giữ lại kỷ niệm sau hành trình"} onPress={() => manage("ARCHIVE")} />
          {!archived && <SettingCard icon="swap" tone="slate" title="Chuyển chủ chuyến đi" subtitle="Chọn một thành viên trong nhóm" onPress={() => manage("TRANSFER")} />}
          <SettingCard destructive icon="trash" tone="peach" title="Xóa chuyến đi" subtitle="Không thể hoàn tác" onPress={() => manage("DELETE")} />
        </> : <SettingCard destructive icon="users" tone="peach" title="Rời chuyến đi" subtitle="Hoàn tất nghĩa vụ quỹ trước khi rời" onPress={() => router.push({ pathname: "/trip/[id]/membership-action", params: { id } })} />}
      </CardSection>}

      <CardSection title="Nhóm và kế hoạch">
        <SettingCard icon="users" tone="blue" title="Bạn đồng hành" subtitle="Thành viên và lời mời" onPress={() => router.push({ pathname: "/trip/[id]/members", params: { id } })} />
        {!archived && <SettingCard icon="mail" tone="mint" title="Mời bạn bè" subtitle="Mã mời, mã QR hoặc email" onPress={() => router.push({ pathname: "/trip/[id]/invite", params: { id } })} />}
        <SettingCard icon="file" tone="peach" title="Xuất & chia sẻ" subtitle="Gửi kế hoạch, tải PDF hoặc thêm vào lịch" onPress={() => router.push({ pathname: "/trip/[id]/export", params: { id } })} />
      </CardSection>
      {success && <DesignPopup kind="settings" message="Các tùy chọn chuyến đi đã được ghi nhận." onPrimary={() => { setSuccess(false); router.dismissTo({ pathname: "/trip/[id]", params: { id } }); }} onClose={() => setSuccess(false)} />}
    </>}
    <Sheet visible={picking && !!owner && !archived} title="Ai được sửa lịch trình?" onClose={() => setPicking(false)}>
      <Text style={typography.footnote}>Chủ nhóm luôn có quyền sửa. Không chọn ai nghĩa là chỉ chủ nhóm được sửa.</Text>
      {eligible.map(member => {
        const checked = selected.includes(member.id);
        return <Pressable cssInterop={false} key={member.id} accessibilityRole="checkbox" accessibilityLabel={"Cho phép " + memberName(member) + " sửa lịch trình"} accessibilityState={{ checked }}
          style={({ pressed }) => [styles.member, pressed && { opacity: 0.7 }]} onPress={() => setSelected(old => old.includes(member.id) ? old.filter(value => value !== member.id) : [...old, member.id])}>
          <View style={styles.initial}><Text style={styles.initialText}>{initialOf(memberName(member))}</Text></View>
          <Text style={[typography.body, { flex: 1 }]}>{memberName(member)}</Text>
          <View style={[styles.check, checked && styles.checkOn]}>{checked && <Text style={styles.checkMark}>✓</Text>}</View>
        </Pressable>;
      })}
      {membersReady && !eligible.length && <Text style={typography.footnote}>Nhóm chưa có thành viên nào khác.</Text>}
      <Button label="Chọn xong" onPress={() => { setChoice("SELECTED_MEMBERS"); setPicking(false); }} />
    </Sheet>
    <Sheet visible={confirm && !!owner && !archived} dismissible={!command.busy} title="Thay thế quyền chỉnh sửa?" onClose={() => setConfirm(false)}>
      <Text style={typography.body}>Chỉ chủ nhóm và {selected.length} thành viên vừa chọn sẽ được chỉnh sửa lịch trình. Quyền cũ của những người khác sẽ bị gỡ.</Text>
      {command.error && <Feedback message={command.error} />}
      <Button label="Xác nhận thay thế quyền" loading={command.busy} disabled={!canSave} onPress={() => { void save(); }} />
    </Sheet>
  </Screen>;
}

function shortPeriod(trip: Trip) {
  const first = dateKey(trip.start_at, trip.timezone), last = lastTripDay(trip);
  if (first === last) return calendarLabel(last);
  return first.slice(0, 7) === last.slice(0, 7) ? `${first.slice(8)}–${calendarLabel(last)}` : `${calendarLabel(first)} – ${calendarLabel(last)}`;
}

function initialOf(name: string) {
  return name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase() ?? "?";
}

const policyTitles: Record<PlanPolicy, string> = { OWNER_ONLY: "Chỉ chủ nhóm sửa lịch", ALL_MEMBERS: "Cả nhóm cùng sửa lịch", SELECTED_MEMBERS: "Thành viên được chọn sửa lịch" };

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 84, paddingVertical: 10, paddingLeft: 10, paddingRight: 12, borderRadius: 26, marginTop: -10, backgroundColor: colors.surface, ...shadows.glass },
  thumb: { width: 64, height: 64, borderRadius: 20 },
  heroCopy: { flex: 1, minWidth: 0, gap: 2 },
  heroTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.ink },
  edit: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 7, paddingLeft: 10, paddingRight: 12, borderRadius: radii.pill, backgroundColor: colors.tealSoft },
  editText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.blue },
  member: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  initial: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  initialText: { fontFamily: fonts.heading, color: colors.teal },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkMark: { color: colors.surface, fontFamily: fonts.heading, fontSize: 13 },
});
