import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useSession } from "@/features/auth/session/session-provider";
import { useResource } from "@/shared/hooks/use-resource";
import { operationCommitted } from "@/shared/operations/controller";
import { OperationFeedback } from "@/shared/operations/operation-feedback";
import { useTripOperation } from "@/shared/operations/use-trip-operation";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Heading, Notice, ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
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
    if (committed && completed === "DELETE") router.replace("/(tabs)/trips");
    else if (committed) router.replace({ pathname: "/trip/[id]/settings", params: { id } });
    else { await resource.reload(); await members.reload(); }
  }
  return <Screen title="Quản lý chuyến đi">
    <Heading title="Quản lý chuyến đi" subtitle={data?.trip.name} />
    <OperationFeedback operation={operation} onFinish={finish} finishLabel={operationCommitted(operation.pending) ? "Hoàn tất" : "Tải lại dữ liệu"} />
    {!operation.pending && <>
      <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
      {data && <>
        {!owner ? <Notice>Chỉ chủ nhóm hiện tại được thực hiện các thao tác này.</Notice> : <>
          <Segments scroll value={selectedAction} items={[{ value: archived ? "REOPEN" : "ARCHIVE", label: archived ? "Mở lại" : "Lưu trữ" }, ...(!archived ? [{ value: "TRANSFER" as const, label: "Chuyển chủ" }] : []), { value: "DELETE", label: "Xóa" }]} onChange={value => { if (!operation.busy) { setAction(value as Action); setTarget(""); setName(""); } }} />
          <Notice>Lưu trữ giữ kế hoạch ở chế độ chỉ xem và có thể mở lại. Xóa ẩn chuyến đi với mọi thành viên; lịch sử tài chính và kiểm toán được giữ ở máy chủ. Cả hai yêu cầu quỹ đã đóng.</Notice>
          {selectedAction === "TRANSFER" && <>
            <Notice>Chủ cũ trở thành thành viên. Người giữ quỹ và tài khoản nhận tiền giữ nguyên; hoàn tất bàn giao hoặc phiên chốt quỹ đang chờ trước khi chuyển chủ. Các lời mời cũ sẽ bị thu hồi.</Notice>
            <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />
            {eligible.map(m => <Button key={m.id} label={`${target === m.id ? "✓ " : ""}${memberName(m)}`} variant={target === m.id ? "primary" : "soft"} disabled={operation.locked} onPress={() => setTarget(m.id)} />)}
            {!members.loading && !eligible.length && <Text style={typography.footnote}>Cần ít nhất một thành viên khác đang tham gia.</Text>}
          </>}
          {selectedAction === "DELETE" && <FormField icon="edit" label="Nhập đúng tên chuyến đi để xóa" value={name} onChangeText={setName} editable={!operation.locked} maxLength={200} />}
          <FormField icon="edit" label="Lý do thay đổi" value={reason} onChangeText={setReason} editable={!operation.locked} maxLength={1000} multiline />
          <Button label={labels[selectedAction]} variant={selectedAction === "DELETE" ? "destructive" : "soft"} disabled={!allowed} onPress={() => setConfirm(true)} />
        </>}
      </>}
    </>}
    {!(operationCommitted(operation.pending) && operation.pending?.targetId === "DELETE") && <Button label="Kiểm tra quỹ và nghĩa vụ" variant="soft" onPress={() => router.push({ pathname: "/trip/[id]/fund", params: { id } })} />}
    <Sheet visible={confirm} title={`Xác nhận ${labels[selectedAction].toLowerCase()}?`} onClose={() => setConfirm(false)} dismissible={!operation.busy}>
      <Text style={typography.body}>{data?.trip.name}</Text>
      {selectedAction === "TRANSFER" && <Text style={typography.body}>Chủ mới: {eligible.find(m => m.id === target) ? memberName(eligible.find(m => m.id === target)!) : ""}</Text>}
      <Text style={typography.body}>Lý do: {reason.trim()}</Text>
      <Button label="Xác nhận thay đổi chuyến đi" variant={selectedAction === "DELETE" ? "destructive" : "primary"} disabled={!allowed} loading={operation.busy} onPress={() => { void submit(); }} />
    </Sheet>
  </Screen>;
}
