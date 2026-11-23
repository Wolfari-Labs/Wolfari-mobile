import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { ChoiceCard } from "@/shared/ui/choice-card";
import type { DesignIconName } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { SettingsGroup, SettingsRow, type RowTone } from "@/shared/ui/settings-list";
import { Sheet } from "@/shared/ui/sheet";
import { Snackbar } from "@/shared/ui/toast";
import { collectPages } from "../api/pagination";
import { coverFor } from "../components/trip-card";
import { TripCoverImage } from "../components/trip-cover";
import { useTrip } from "../hooks/use-trip";
import type { PlanPolicy } from "../types";
import { tripDates } from "../utils";
import { memberName } from "../model/member-name";

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
  const members = useResource(useCallback((signal: AbortSignal) => collectPages(cursor => api.trips.members(id, cursor, signal), signal), [api, id]), !!owner && (choice ?? currentPolicy) === "SELECTED_MEMBERS");
  const eligible = members.data?.filter(member => !member.left_at && member.role !== "OWNER") ?? [];
  async function save() {
    if (!data || !choice || !writable) return;
    const editors = choice === "SELECTED_MEMBERS" ? selected : [];
    if (editors.some(editor => !eligible.some(member => member.id === editor))) return;
    const revision = policy.data!.membership_revision;
    const result = await command.run({ policy: choice, editors, revision }, key => api.trips.policy({ ...data.trip, membership_revision: revision }, choice, editors, key));
    if (result) { setConfirm(false); setChoice(undefined); setSelected([]); setSuccess(true); await Promise.all([resource.reload(), policy.reload()]); }
  }
  const shownPolicy = choice ?? currentPolicy ?? data?.trip.plan_edit_policy;
  const roleLabel = owner ? "Chủ nhóm" : "Thành viên";
  return <Screen title="Cài đặt chuyến đi" tab="trips" onRefresh={() => { void Promise.all([resource.reload(), policy.reload()]); }} refreshing={(resource.loading || policy.loading) && !!data}>
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <>
      <View style={styles.hero}>
        <TripCoverImage trip={data.trip} fallback={coverFor(data.trip)} style={StyleSheet.absoluteFill} label={data.trip.name} />
        <LinearGradient colors={["rgba(31,42,68,0)", "rgba(31,42,68,0.78)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroCopy}>
          <View style={styles.role}><Text style={styles.roleText}>{roleLabel}</Text></View>
          <Text style={styles.heroTitle} numberOfLines={2}>{data.trip.name}</Text>
          <Text style={styles.heroDates}>{tripDates(data.trip)}</Text>
        </View>
        {data.trip.permissions.can_update && <View style={styles.heroAction}><Button label="Chỉnh sửa thông tin" variant="soft" compact icon="edit" onPress={() => router.push({ pathname: "/trip/[id]/edit", params: { id } })} /></View>}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Ai được sửa lịch trình?</Text>
        <Text style={typography.footnote}>Áp dụng cho lịch trình, địa điểm, hành lý và dress code của nhóm.</Text>
        {owner && !archived ? <>
          <ResourceFeedback {...policy} hasData={!!policy.data} onRetry={() => { void policy.reload(); }} />
          <View accessibilityRole="radiogroup" style={styles.choices}>
            {(["OWNER_ONLY", "ALL_MEMBERS", "SELECTED_MEMBERS"] as const).map(value => <ChoiceCard key={value} title={policyChoices[value].title} description={policyChoices[value].description}
              icon={policyChoices[value].icon} tone={policyChoices[value].tone} selected={shownPolicy === value} disabled={command.busy || !writable}
              onPress={() => { if (command.busy || !writable) return; setChoice(value === currentPolicy ? undefined : value); setSelected(value === "SELECTED_MEMBERS" ? [...(policy.data?.editor_member_ids ?? [])] : []); setSuccess(false); }} />)}
          </View>
          {currentPolicy === "SELECTED_MEMBERS" && !choice && <>
            <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />
            {members.data && !members.loading && !members.error && policy.data && !policy.loading && !policy.error && <Text style={typography.footnote}>Được sửa: {eligible.filter(member => policy.data?.editor_member_ids.includes(member.id)).map(member => memberName(member)).join(", ") || "Chỉ chủ nhóm"}</Text>}
          </>}
          {choice === "SELECTED_MEMBERS" && <View style={styles.memberCard}>
            <Text style={typography.footnote}>Chọn người được sửa kế hoạch. Chủ nhóm luôn có quyền sửa.</Text>
            <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />
            {eligible.map(member => {
              const checked = selected.includes(member.id);
              return <Pressable cssInterop={false} key={member.id} accessibilityRole="checkbox" accessibilityLabel={"Cho phép " + memberName(member) + " sửa lịch trình"} accessibilityState={{ checked, disabled: command.busy }} disabled={command.busy}
                style={({ pressed }) => [styles.member, pressed && { opacity: 0.7 }]} onPress={() => setSelected(old => old.includes(member.id) ? old.filter(value => value !== member.id) : [...old, member.id])}>
                <View style={styles.initial}><Text style={styles.initialText}>{initialOf(memberName(member))}</Text></View>
                <Text style={[typography.body, { flex: 1 }]}>{memberName(member)}</Text>
                <View style={[styles.check, checked && styles.checkOn]}>{checked && <Text style={styles.checkMark}>✓</Text>}</View>
              </Pressable>;
            })}
            {members.data && !eligible.length && <Text style={typography.footnote}>Nhóm chưa có thành viên nào khác.</Text>}
            <Text style={typography.footnote}>Đã chọn {selected.length} thành viên. Không chọn ai nghĩa là chỉ chủ nhóm được sửa.</Text>
          </View>}
          {command.error && <><Feedback message={command.error} /><Button label="Tải thông tin mới nhất" variant="soft" onPress={() => { setChoice(undefined); setSelected([]); command.clearError(); void Promise.all([resource.reload(), policy.reload()]); }} /></>}
          <Snackbar message={success ? "Đã cập nhật quyền chỉnh sửa của nhóm." : undefined} />
          {choice && <Button label="Lưu quyền của nhóm" loading={command.busy} disabled={!writable || !choice || (choice === "SELECTED_MEMBERS" && (!members.data || members.loading || !!members.error))} onPress={() => { if (choice === "SELECTED_MEMBERS") setConfirm(true); else void save(); }} />}
        </> : <View style={styles.readonly}>
          <Text style={typography.headline}>{policyChoices[currentPolicy ?? data.trip.plan_edit_policy].title}</Text>
          <Text style={typography.footnote}>{archived ? "Chuyến đi đã lưu trữ. Quyền của nhóm chỉ có thể xem." : "Người tổ chức quản lý quyền sửa kế hoạch của các thành viên."}</Text>
        </View>}
      </View>

      <SettingsGroup title="Nhóm">
        <SettingsRow icon="users" tone="blue" title="Bạn đồng hành" subtitle="Thành viên và lời mời" onPress={() => router.push({ pathname: "/trip/[id]/members", params: { id } })} />
        {data.trip.lifecycle !== "ARCHIVED" && <SettingsRow icon="mail" tone="mint" title="Mời bạn bè" subtitle="Mã mời, mã QR hoặc email" onPress={() => router.push({ pathname: "/trip/[id]/invite", params: { id } })} />}
        <SettingsRow icon="bell" tone="peach" title="Lịch nhắc của tôi" subtitle="Nhắc riêng cho hoạt động và hành lý" onPress={() => router.push({ pathname: "/trip/[id]/reminders", params: { id } })} />
        <SettingsRow last icon="calendar" tone="butter" title="Xuất kế hoạch" subtitle="Tải bản PDF để in hoặc gửi" onPress={() => router.push({ pathname: "/trip/[id]/export", params: { id } })} />
      </SettingsGroup>

      {owner && <SettingsGroup title="Quản trị" footer="Lưu trữ, mở lại, chuyển chủ nhóm hoặc xóa chuyến đi.">
        <SettingsRow last icon="gear" tone="lilac" title="Quản lý chuyến đi" onPress={() => router.push({ pathname: "/trip/[id]/manage", params: { id } })} />
      </SettingsGroup>}
      {!owner && data.trip.lifecycle !== "ARCHIVED" && <SettingsGroup>
        <SettingsRow last destructive icon="users" title="Rời chuyến đi" subtitle="Hoàn tất nghĩa vụ quỹ trước khi rời" onPress={() => router.push({ pathname: "/trip/[id]/membership-action", params: { id } })} />
      </SettingsGroup>}
    </>}
    <Sheet visible={confirm && !!owner && !archived} dismissible={!command.busy} title="Thay thế quyền chỉnh sửa?" onClose={() => setConfirm(false)}>
      <Text style={typography.body}>Chỉ chủ nhóm và {selected.length} thành viên vừa chọn sẽ được chỉnh sửa lịch trình. Quyền cũ của những người khác sẽ bị gỡ.</Text>
      {command.error && <Feedback message={command.error} />}
      <Button label="Xác nhận thay thế quyền" loading={command.busy} disabled={!writable} onPress={() => { void save(); }} />
    </Sheet>
  </Screen>;
}

function initialOf(name: string) {
  return name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase() ?? "?";
}

const policyChoices: Record<PlanPolicy, { title: string; description: string; icon: DesignIconName; tone: RowTone }> = {
  OWNER_ONLY: { title: "Chỉ chủ nhóm", description: "Chỉ người tổ chức chỉnh sửa; mọi người xem.", icon: "lock", tone: "lilac" },
  ALL_MEMBERS: { title: "Cả nhóm", description: "Mọi thành viên đều sửa được kế hoạch.", icon: "users", tone: "mint" },
  SELECTED_MEMBERS: { title: "Chọn thành viên", description: "Chủ nhóm và những người bạn chọn.", icon: "user", tone: "blue" },
};

const styles = StyleSheet.create({
  hero: { height: 200, borderRadius: radii.cardLarge, overflow: "hidden", justifyContent: "flex-end", ...shadows.card },
  heroCopy: { padding: 18, gap: 4 },
  heroTitle: { ...typography.title, fontSize: 24, lineHeight: 30, color: colors.surface },
  heroDates: { ...typography.footnote, color: "rgba(255,255,255,0.9)" },
  heroAction: { position: "absolute", top: 12, right: 12 },
  role: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.88)" },
  roleText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  section: { gap: 10 },
  sectionTitle: { ...typography.section },
  choices: { gap: 10 },
  memberCard: { gap: 4, padding: 14, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  member: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  initial: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  initialText: { fontFamily: fonts.heading, color: colors.teal },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkMark: { color: colors.surface, fontFamily: fonts.heading, fontSize: 13 },
  readonly: { padding: 16, gap: 4, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
});
