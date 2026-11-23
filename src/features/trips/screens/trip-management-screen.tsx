import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/features/auth/session/session-provider";
import { useResource } from "@/shared/hooks/use-resource";
import { operationCommitted } from "@/shared/operations/controller";
import { OperationFeedback } from "@/shared/operations/operation-feedback";
import { useTripOperation } from "@/shared/operations/use-trip-operation";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { ChoiceCard } from "@/shared/ui/choice-card";
import type { DesignIconName } from "@/shared/ui/design-assets";
import { FormField } from "@/shared/ui/form-field";
import { Notice, ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { RowIcon, SettingsGroup, SettingsRow, type RowTone } from "@/shared/ui/settings-list";
import { Sheet } from "@/shared/ui/sheet";
import { collectPages } from "../api/pagination";
import { useTrip } from "../hooks/use-trip";
import { memberName } from "../model/member-name";

type Action = "ARCHIVE" | "REOPEN" | "TRANSFER" | "DELETE";
const labels: Record<Action, string> = { ARCHIVE: "Lưu trữ chuyến đi", REOPEN: "Mở lại chuyến đi", TRANSFER: "Chuyển chủ nhóm", DELETE: "Xóa chuyến đi" };
export default function TripManagementScreen() {
  const { profile } = useSession();
  const resource = useTrip();
  return <ManagementWorkspace key={`${profile?.id}:${resource.id}`} resource={resource} />;
}
function ManagementWorkspace({ resource }: { resource: ReturnType<typeof useTrip> }) {
  const { data, id, api } = resource;
  const operation = useTripOperation(id);
  const [action, setAction] = useState<Action>("ARCHIVE");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const owner = data?.trip.current_membership.role === "OWNER";
  const archived = data?.trip.lifecycle === "ARCHIVED";
  const members = useResource(useCallback((signal: AbortSignal) => collectPages(cursor => api.trips.members(id, cursor, signal), signal), [api, id]), !!owner && action === "TRANSFER");
  const eligible = members.data?.filter(m => !m.left_at && m.role !== "OWNER") ?? [];
  const selectedAction = archived && action === "ARCHIVE" ? "REOPEN" : action;
  const allowed = !!owner && !resource.loading && !resource.error && !operation.locked && !!reason.trim() && (selectedAction !== "TRANSFER" || (!archived && !members.loading && !members.error && eligible.some(m => m.id === target))) && (selectedAction !== "DELETE" || name === data?.trip.name);
  async function submit() {
    if (!allowed || !data) return;
    setConfirm(false);
    const suffix = selectedAction === "DELETE" ? "" : selectedAction === "TRANSFER" ? "/ownership" : selectedAction === "REOPEN" ? "/reopen" : "/archive";
    await operation.run({ kind: "trip", title: labels[selectedAction], targetId: selectedAction, method: selectedAction === "DELETE" ? "DELETE" : "POST", path: `/trips/${encodeURIComponent(id)}${suffix}`, body: { reason: reason.trim(), expected_plan_version: data.trip.plan_version, expected_membership_revision: data.trip.membership_revision, expected_export_revision: data.trip.export_revision, ...(selectedAction === "TRANSFER" ? { new_owner_member_id: target } : {}) } });
  }
  async function finish() {
    const committed = operationCommitted(operation.pending), completed = operation.pending?.targetId;
    if (committed && completed === "DELETE") router.dismissTo("/(tabs)/trips");
    else if (committed) router.replace({ pathname: "/trip/[id]/settings", params: { id } });
    else { await resource.reload(); await members.reload(); }
  }
  const actions: Action[] = archived ? ["REOPEN", "DELETE"] : ["ARCHIVE", "TRANSFER", "DELETE"];
  const info = actionInfo[selectedAction];
  return <Screen title="Quản lý chuyến đi">
    <OperationFeedback operation={operation} onFinish={finish} finishLabel={operationCommitted(operation.pending) ? "Hoàn tất" : "Tải lại dữ liệu"} />
    {!operation.pending && <>
      <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
      {data && <>
        <View style={styles.header}>
          <RowIcon icon="gear" tone="lilac" size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={typography.headline} numberOfLines={2}>{data.trip.name}</Text>
            <Text style={typography.footnote}>{archived ? "Đã lưu trữ · chỉ xem" : "Đang hoạt động"}</Text>
          </View>
        </View>
        {!owner ? <Notice>Chỉ chủ nhóm hiện tại được thực hiện các thao tác này.</Notice> : <>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Bạn muốn làm gì?</Text>
          <View accessibilityRole="radiogroup" style={styles.choices}>
            {actions.map(value => <ChoiceCard key={value} title={actionInfo[value].choice} description={actionInfo[value].short} icon={actionInfo[value].icon}
              tone={actionInfo[value].tone} danger={value === "DELETE"} selected={selectedAction === value} disabled={operation.locked}
              onPress={() => { if (!operation.busy) { setAction(value); setTarget(""); setName(""); } }} />)}
          </View>
          <View style={[styles.panel, selectedAction === "DELETE" && styles.dangerPanel]}>
            <Text style={typography.headline}>{labels[selectedAction]}</Text>
            {info.details.map(line => <View key={line} style={styles.bullet}><Text style={styles.dot}>•</Text><Text style={[typography.footnote, { flex: 1 }]}>{line}</Text></View>)}
            {selectedAction === "TRANSFER" && <>
              <Text style={styles.label}>Chủ nhóm mới</Text>
              <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />
              {eligible.map(m => {
                const picked = target === m.id;
                return <Pressable cssInterop={false} key={m.id} accessibilityRole="radio" accessibilityLabel={memberName(m)} accessibilityState={{ checked: picked, disabled: operation.locked }} disabled={operation.locked}
                  onPress={() => setTarget(m.id)} style={({ pressed }) => [styles.member, picked && styles.memberOn, pressed && { opacity: 0.7 }]}>
                  <View style={styles.initial}><Text style={styles.initialText}>{memberName(m).trim().split(/\s+/).at(-1)?.[0]?.toUpperCase() ?? "?"}</Text></View>
                  <Text style={[typography.body, { flex: 1 }]}>{memberName(m)}</Text>
                  {picked && <Text style={styles.pickedMark}>✓</Text>}
                </Pressable>;
              })}
              {!members.loading && !eligible.length && <Text style={typography.footnote}>Cần ít nhất một thành viên khác đang tham gia.</Text>}
            </>}
            {selectedAction === "DELETE" && <FormField icon="edit" label="Nhập đúng tên chuyến đi để xóa" value={name} onChangeText={setName} editable={!operation.locked} maxLength={200} placeholder={data.trip.name} />}
            <FormField icon="edit" label="Lý do thay đổi" value={reason} onChangeText={setReason} editable={!operation.locked} maxLength={1000} multiline placeholder="Ví dụ: chuyến đi đã kết thúc" />
            <Button label={labels[selectedAction]} variant={selectedAction === "DELETE" ? "destructive" : "primary"} disabled={!allowed} onPress={() => setConfirm(true)} />
          </View>
        </>}
      </>}
    </>}
    {!(operationCommitted(operation.pending) && operation.pending?.targetId === "DELETE") && <SettingsGroup footer="Lưu trữ và xóa cần quỹ nhóm đã đóng.">
      <SettingsRow last icon="wallet" tone="mint" title="Kiểm tra quỹ và nghĩa vụ" onPress={() => router.push({ pathname: "/trip/[id]/fund", params: { id } })} />
    </SettingsGroup>}
    <Sheet visible={confirm} title={`Xác nhận ${labels[selectedAction].toLowerCase()}?`} onClose={() => setConfirm(false)} dismissible={!operation.busy}>
      <Text style={typography.body}>{data?.trip.name}</Text>
      {selectedAction === "TRANSFER" && <Text style={typography.body}>Chủ mới: {eligible.find(m => m.id === target) ? memberName(eligible.find(m => m.id === target)!) : ""}</Text>}
      <Text style={typography.body}>Lý do: {reason.trim()}</Text>
      <Button label="Xác nhận thay đổi chuyến đi" variant={selectedAction === "DELETE" ? "destructive" : "primary"} disabled={!allowed} loading={operation.busy} onPress={() => { void submit(); }} />
    </Sheet>
  </Screen>;
}

const actionInfo: Record<Action, { choice: string; short: string; icon: DesignIconName; tone: RowTone; details: string[] }> = {
  ARCHIVE: {
    choice: "Lưu trữ", short: "Giữ lại để xem, khóa chỉnh sửa", icon: "bag", tone: "butter",
    details: ["Kế hoạch chuyển sang chỉ xem cho mọi người.", "Có thể mở lại bất cứ lúc nào.", "Cần quỹ nhóm đã đóng."],
  },
  REOPEN: {
    choice: "Mở lại", short: "Cho nhóm tiếp tục chỉnh sửa", icon: "trip", tone: "mint",
    details: ["Thành viên lại có thể sửa theo quyền đã đặt.", "Lịch sử và quỹ giữ nguyên."],
  },
  TRANSFER: {
    choice: "Chuyển chủ", short: "Giao quyền tổ chức cho người khác", icon: "users", tone: "blue",
    details: ["Chủ cũ trở thành thành viên.", "Người giữ quỹ và tài khoản nhận tiền giữ nguyên; hoàn tất bàn giao hoặc phiên chốt quỹ đang chờ trước khi chuyển chủ.", "Các lời mời cũ sẽ bị thu hồi."],
  },
  DELETE: {
    choice: "Xóa", short: "Ẩn chuyến đi với mọi thành viên", icon: "lock", tone: "peach",
    details: ["Không hoàn tác được trong ứng dụng.", "Lịch sử tài chính và kiểm toán được giữ ở máy chủ.", "Cần quỹ nhóm đã đóng."],
  },
};

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  sectionTitle: { ...typography.section },
  choices: { gap: 10 },
  panel: { gap: 10, padding: 16, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  dangerPanel: { borderWidth: 1.5, borderColor: colors.error },
  bullet: { flexDirection: "row", gap: 8 },
  dot: { ...typography.footnote, color: colors.teal },
  label: { ...typography.eyebrow, textTransform: "uppercase", marginTop: 4 },
  member: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 10, borderRadius: radii.control, borderWidth: 2, borderColor: "transparent" },
  memberOn: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  initial: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  initialText: { fontFamily: fonts.heading, color: colors.teal },
  pickedMark: { fontFamily: fonts.heading, color: colors.teal, fontSize: 16 },
});
