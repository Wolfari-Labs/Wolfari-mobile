import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Heading, Notice, ResourceFeedback, SectionLink, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { collectPages } from "../api/pagination";
import { coverFor } from "../components/trip-card";
import { useTrip } from "../hooks/use-trip";
import type { PlanPolicy } from "../types";
import { tripDates } from "../utils";
import { memberName } from "../model/member-name";

const policyLabels: Record<PlanPolicy, string> = { OWNER_ONLY: "Chỉ người tổ chức", ALL_MEMBERS: "Tất cả thành viên", SELECTED_MEMBERS: "Các thành viên được chọn" };
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
  return <Screen title="Cài đặt chuyến đi" tab="trips" onRefresh={() => { void Promise.all([resource.reload(), policy.reload()]); }} refreshing={(resource.loading || policy.loading) && !!data}>
    <Heading title={"Một chuyến đi,\ncùng một nhịp"} />
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <>
      <View style={[ui.row, { marginVertical: 12 }]}><Image source={coverFor(data.trip)} style={{ width: 76, height: 76, borderRadius: 20 }} contentFit="cover" /><View style={ui.flex}><Text style={typography.headline}>{data.trip.name}</Text><Text style={typography.footnote}>{tripDates(data.trip)}</Text></View></View>
      {data.trip.permissions.can_update && <Button label="Chỉnh sửa thông tin" variant="soft" onPress={() => router.push({ pathname: "/trip/[id]/edit", params: { id } })} />}
      <Text accessibilityRole="header" style={typography.section}>Quyền trong nhóm</Text>
      <Text style={typography.body}>Ai có thể chỉnh sửa lịch trình?</Text>
      <Text style={typography.footnote}>Hiện tại: {policyLabels[currentPolicy ?? data.trip.plan_edit_policy]}</Text>
      {owner && !archived ? <>
        <ResourceFeedback {...policy} hasData={!!policy.data} onRetry={() => { void policy.reload(); }} />
        <Segments scroll items={[{ value: "OWNER_ONLY", label: "Chỉ chủ nhóm" }, { value: "ALL_MEMBERS", label: "Cả nhóm" }, { value: "SELECTED_MEMBERS", label: "Chọn thành viên" }]} value={choice ?? currentPolicy ?? data.trip.plan_edit_policy} onChange={value => { if (command.busy || !writable) return; setChoice(value); setSelected(value === "SELECTED_MEMBERS" ? [...(policy.data?.editor_member_ids ?? [])] : []); setSuccess(false); }} />
        {currentPolicy === "SELECTED_MEMBERS" && !choice && <>
          <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />
          {members.data && !members.loading && !members.error && policy.data && !policy.loading && !policy.error && <Text style={typography.footnote}>Được sửa: {eligible.filter(member => policy.data?.editor_member_ids.includes(member.id)).map(member => memberName(member)).join(", ") || "Chỉ chủ nhóm"}</Text>}
        </>}
        {choice === "SELECTED_MEMBERS" && <>
          <Notice>Đã chọn sẵn người đang có quyền. Thay đổi sẽ cập nhật danh sách của nhóm; chủ nhóm luôn giữ quyền sửa.</Notice>
          <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />
          {eligible.map(member => <Pressable key={member.id} accessibilityRole="checkbox" accessibilityLabel={"Cho phép " + memberName(member) + " sửa lịch trình"} accessibilityState={{ checked: selected.includes(member.id), disabled: command.busy }} disabled={command.busy} style={ui.link} onPress={() => setSelected(old => old.includes(member.id) ? old.filter(value => value !== member.id) : [...old, member.id])}>
            <Text style={typography.headline}>{selected.includes(member.id) ? "✓" : "○"} {memberName(member)}</Text>
          </Pressable>)}
          <Text style={typography.footnote}>Đã chọn {selected.length} thành viên. Không chọn ai nghĩa là chỉ chủ nhóm được sửa.</Text>
        </>}
        {command.error && <><Feedback message={command.error} /><Button label="Tải thông tin mới nhất" variant="soft" onPress={() => { setChoice(undefined); setSelected([]); command.clearError(); void Promise.all([resource.reload(), policy.reload()]); }} /></>}
        {success && <Feedback success message="Đã cập nhật quyền chỉnh sửa của nhóm." />}
        <Button label="Lưu quyền của nhóm" loading={command.busy} disabled={!writable || !choice || (choice === "SELECTED_MEMBERS" && (!members.data || members.loading || !!members.error))} onPress={() => { if (choice === "SELECTED_MEMBERS") setConfirm(true); else void save(); }} />
      </> : <Text style={typography.footnote}>{archived ? "Chuyến đi đã lưu trữ. Quyền của nhóm chỉ có thể xem." : "Người tổ chức quản lý quyền sửa kế hoạch của các thành viên."}</Text>}
      {owner && <SectionLink title="Quản lý chuyến đi" subtitle="Lưu trữ, mở lại, chuyển chủ hoặc xóa" icon="gear" onPress={() => router.push({ pathname: "/trip/[id]/manage", params: { id } })} />}
      <SectionLink title="Bạn đồng hành" subtitle="Thành viên và lời mời" icon="users" onPress={() => router.push({ pathname: "/trip/[id]/members", params: { id } })} />
      {!owner && data.trip.lifecycle !== "ARCHIVED" && <Button label="Rời chuyến đi" variant="destructive" onPress={() => router.push({ pathname: "/trip/[id]/membership-action", params: { id } })} />}
    </>}
    <Sheet visible={confirm && !!owner && !archived} dismissible={!command.busy} title="Thay thế quyền chỉnh sửa?" onClose={() => setConfirm(false)}>
      <Text style={typography.body}>Chỉ chủ nhóm và {selected.length} thành viên vừa chọn sẽ được chỉnh sửa lịch trình. Quyền cũ của những người khác sẽ bị gỡ.</Text>
      {command.error && <Feedback message={command.error} />}
      <Button label="Xác nhận thay thế quyền" loading={command.busy} disabled={!writable} onPress={() => { void save(); }} />
    </Sheet>
  </Screen>;
}
