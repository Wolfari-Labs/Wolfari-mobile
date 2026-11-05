import { router, useLocalSearchParams } from "expo-router";
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
import { Heading, Notice, ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { collectPages } from "../api/pagination";
import { useTrip } from "../hooks/use-trip";

export default function MembershipActionScreen() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId?: string }>();
  const { profile } = useSession();
  return <MembershipWorkspace key={`${profile?.id}:${id}:${memberId ?? "self"}`} memberId={memberId} />;
}

function MembershipWorkspace({ memberId }: { memberId?: string }) {
  const resource = useTrip(), { data, api, id } = resource;
  const operation = useTripOperation(id);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const members = useResource(useCallback((signal: AbortSignal) => collectPages(cursor => api.trips.members(id, cursor, signal), signal), [api, id]), !!memberId && !operation.pending);
  const target = members.data?.find(member => member.id === memberId && !member.left_at && member.role === "MEMBER");
  const allowed = !!data && !resource.loading && !resource.error && data.trip.lifecycle !== "ARCHIVED" && !operation.locked
    && (memberId ? data.trip.current_membership.role === "OWNER" && !!target && !members.loading && !members.error : data.trip.current_membership.role === "MEMBER");
  const validReason = !!reason.trim() && reason.trim().length <= 1000 && !reason.includes("\0");
  const title = memberId ? "Xóa thành viên khỏi chuyến đi" : "Rời chuyến đi";
  const pending = operation.pending;
  async function submit() {
    if (!allowed || !validReason || !data) return;
    setConfirm(false);
    await operation.run({ kind: memberId ? "remove" : "leave", title, targetId: memberId,
      method: memberId ? "DELETE" : "POST",
      path: memberId ? `/trips/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}` : `/trips/${encodeURIComponent(id)}/leave`,
      body: { reason: reason.trim(), expected_membership_revision: data.trip.membership_revision },
    });
  }
  async function finish() {
    if (operationCommitted(pending) && pending?.kind === "leave") router.replace("/(tabs)/trips");
    else if (pending?.kind === "remove") router.replace({ pathname: "/trip/[id]/members", params: { id } });
    else { await resource.reload(); await members.reload(); }
  }
  return <Screen title={title}>
    <Heading title={title} subtitle={data?.trip.name} />
    <OperationFeedback operation={operation} onFinish={finish} finishLabel={operationCommitted(pending) ? "Hoàn tất" : "Tải lại thông tin nhóm"} />
    {!pending && <>
      <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
      {!!memberId && <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />}
      {data && <>
        {target && <Text selectable style={typography.body}>Tài khoản thành viên: {target.user_id}</Text>}
        <Notice>Máy chủ kiểm tra nghĩa vụ tài chính trước khi cho rời/xóa. Giao dịch đang chờ, hoàn tiền chưa xử lý, phiên đóng quỹ hoặc người đang giữ quỹ chưa đóng có thể chặn thao tác. Chủ nhóm không được tự rời hay bị xóa qua chức năng này.</Notice>
        <Notice>Khoản đóng góp PENDING đủ điều kiện sẽ được miễn tự động khi rời nhóm; lịch sử đóng góp, chi và hoàn tiền không bị xóa. Không được xem là đã rời cho đến khi máy chủ xác nhận hoàn tất.</Notice>
        <FormField icon="edit" label="Lý do" value={reason} onChangeText={setReason} maxLength={1000} multiline editable={allowed} />
        <Button label={memberId ? "Xóa thành viên" : "Rời chuyến đi"} variant="destructive" disabled={!allowed || !validReason} onPress={() => setConfirm(true)} />
        {!allowed && !members.loading && <Text style={typography.footnote}>Chờ tải đủ thông tin hoặc kiểm tra quyền và trạng thái thành viên.</Text>}
      </>}
    </>}
    {!(pending?.kind === "leave" && operationCommitted(pending)) && <Button label="Kiểm tra quỹ và nghĩa vụ" variant="soft" onPress={() => router.push({ pathname: "/trip/[id]/fund", params: { id } })} />}
    <Notice>Nếu backend đang tắt TRIP_MEMBERSHIP_LIFECYCLE_ENABLED, cần bật trong môi trường đã được kiểm thử. Mobile không tự thay cấu hình backend.</Notice>
    <Sheet visible={confirm} title="Xác nhận thay đổi thành viên?" dismissible={!operation.busy} onClose={() => { if (!operation.busy) setConfirm(false); }}>
      {target && <Text selectable style={typography.body}>Tài khoản: {target.user_id}</Text>}
      <Text style={typography.body}>{memberId ? "Thành viên sẽ mất quyền truy cập chuyến đi sau khi thao tác hoàn tất." : "Bạn sẽ mất quyền truy cập chuyến đi sau khi yêu cầu hoàn tất."}</Text>
      <Text style={typography.body}>Lý do: {reason.trim()}</Text>
      <Button label="Xác nhận thực hiện" variant="destructive" loading={operation.busy} disabled={!allowed || !validReason} onPress={() => { void submit(); }} />
    </Sheet>
  </Screen>;
}
