import { randomUUID } from "expo-crypto";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState, Text } from "react-native";

import { useSession } from "@/features/auth/session/session-provider";
import { ApiError } from "@/shared/api/api-client";
import { errorMessage } from "@/shared/api/errors";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { Heading, Notice, ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { collectPages } from "../api/pagination";
import { useTrip } from "../hooks/use-trip";
import { membershipCommitted, membershipMessage, membershipPending, pendingMembershipRequests, type MembershipRequest } from "../membership-operation";
import type { MembershipOperation } from "../types";

export default function MembershipActionScreen() {
  const resource = useTrip();
  const { data, api, id } = resource;
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const { profile } = useSession();
  const scope = `${profile?.id}:${id}`;
  const [pending, setPending] = useState(() => pendingMembershipRequests.get(scope));
  const [reason, setReason] = useState(pending?.reason ?? "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string>();
  const locked = useRef(false);
  const targetId = pending ? pending.memberId : memberId;
  const members = useResource(useCallback((signal: AbortSignal) => collectPages(cursor => api.trips.members(id, cursor, signal), signal), [api, id]), !!targetId && !pending);
  const target = members.data?.find(member => member.id === targetId && !member.left_at && member.role === "MEMBER");
  const allowed = !!data && data.trip.lifecycle !== "ARCHIVED" && (targetId ? data.trip.current_membership.role === "OWNER" && !!target : data.trip.current_membership.role === "MEMBER");
  const title = targetId ? "Xóa thành viên khỏi chuyến đi" : "Rời chuyến đi";
  const remember = useCallback((request: MembershipRequest) => { pendingMembershipRequests.set(scope, request); setPending(request); }, [scope]);
  const receive = useCallback((operation: MembershipOperation) => {
    const current = pendingMembershipRequests.get(scope);
    if (!current || current.key !== operation.operation_id || current.trip.id !== operation.trip_id) return;
    // A slower poll must not downgrade a terminal receipt.
    if (current.operation?.state === "SUCCEEDED" || current.operation?.state === "FAILED") return;
    remember({ ...current, operation });
  }, [scope, remember]);
  const operationId = pending?.key;
  const polling = !!operationId && membershipPending(pending?.operation) && !blocked;
  useFocusEffect(useCallback(() => {
    if (!operationId || !polling) return;
    let active = true, pollingNow = false;
    const controller = new AbortController();
    async function poll() {
      if (!active || pollingNow || AppState.currentState !== "active") return;
      pollingNow = true;
      try { const result = await api.trips.operation(operationId!, controller.signal); if (active) receive(result); }
      catch { /* Unknown/404 is not evidence that the original request failed. Manual retry stays available. */ }
      finally { pollingNow = false; }
    }
    void poll();
    const timer = setInterval(() => { void poll(); }, 5000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void poll(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); controller.abort(); };
  }, [api, operationId, polling, receive]));
  async function submit() {
    if (locked.current || blocked) return;
    const previous = pendingMembershipRequests.get(scope);
    if (!previous && (!data || !allowed || !reason.trim() || reason.trim().length > 1000)) { setError("Nhập lý do từ 1 đến 1000 ký tự và kiểm tra quyền thao tác."); return; }
    const request = previous ?? { key: randomUUID(), trip: data!.trip, memberId: targetId, reason: reason.trim() };
    locked.current = true; setBusy(true); setError(undefined); setConfirm(false); remember(request);
    try {
      const operation = request.memberId
        ? await api.trips.removeMember(request.trip, request.memberId, request.reason, request.key)
        : await api.trips.leave(request.trip, request.reason, request.key);
      receive(operation);
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) setBlocked(true);
    } finally { locked.current = false; setBusy(false); }
  }
  async function check() {
    if (!pending || locked.current) return;
    locked.current = true; setBusy(true); setError(undefined);
    try { receive(await api.trips.operation(pending.key)); }
    catch (cause) { setError(cause instanceof ApiError && cause.status === 404 ? "Chưa tìm thấy kết quả. Giữ mã yêu cầu và thử lại cùng yêu cầu cũ." : errorMessage(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  function finish() {
    pendingMembershipRequests.delete(scope);
    if (!targetId) router.replace("/(tabs)/trips");
    else router.replace({ pathname: "/trip/[id]/members", params: { id } });
  }
  return <Screen title={title}>
    <Heading title={title} subtitle={pending?.trip.name ?? data?.trip.name} />
    {error && <Feedback message={error} />}
    {pending ? <>
      {membershipCommitted(pending.operation) ? <Feedback success message={membershipMessage(pending.operation)} /> : pending.operation?.state === "FAILED" ? <Feedback message={membershipMessage(pending.operation)} /> : <Notice>{membershipMessage(pending.operation)}</Notice>}
      <Text style={typography.footnote}>Mã yêu cầu · giữ lại để tra cứu hoặc liên hệ hỗ trợ</Text>
      <Text selectable style={typography.body}>{pending.key}</Text>
      <Text style={typography.body}>{pending.memberId ? `Thành viên · ${pending.memberId.slice(0, 8)}` : "Rời nhóm bằng tài khoản của bạn"}</Text>
      {membershipCommitted(pending.operation) ? <Button label="Hoàn tất" onPress={finish} /> : <>
        <Button label="Kiểm tra trạng thái" variant="soft" loading={busy} onPress={() => { void check(); }} />
        {!pending.operation && !blocked && <Button label="Gửi lại cùng yêu cầu" loading={busy} onPress={() => { void submit(); }} />}
        {(blocked || pending.operation?.state === "FAILED") && <Button label="Tải lại thông tin nhóm" disabled={busy} onPress={finish} />}
        <Notice>Yêu cầu đã gửi có thể vẫn đang xử lý khi bạn đóng màn hình. Bản nháp chỉ được giữ trong lần mở app hiện tại. Không gửi một yêu cầu khác khi chưa rõ kết quả.</Notice>
      </>}
    </> : <>
      <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
      {!!targetId && <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />}
      {data && <>
        {target && <Text selectable style={typography.body}>Tài khoản thành viên: {target.user_id}</Text>}
        <Notice>Thao tác có thể bị chặn bởi nghĩa vụ tài chính hoặc cấu hình backend. Chủ nhóm không thể tự rời nhóm hay bị xóa qua chức năng này.</Notice>
        <FormField icon="edit" label="Lý do" value={reason} onChangeText={setReason} maxLength={1000} multiline editable={allowed && !busy} />
        <Button label={targetId ? "Xóa thành viên" : "Rời chuyến đi"} variant="destructive" disabled={!allowed || !reason.trim()} onPress={() => setConfirm(true)} />
        {!allowed && !members.loading && <Text style={typography.footnote}>Bạn không có quyền thực hiện thao tác này hoặc thành viên không còn hợp lệ.</Text>}
      </>}
    </>}
    <Sheet visible={confirm} title="Xác nhận thay đổi thành viên?" onClose={() => setConfirm(false)}>
      {target && <Text selectable style={typography.body}>Tài khoản: {target.user_id}</Text>}
      <Text style={typography.body}>{targetId ? "Thành viên này sẽ mất quyền truy cập chuyến đi nếu thao tác được hoàn tất." : "Bạn sẽ mất quyền truy cập chuyến đi nếu yêu cầu rời nhóm được hoàn tất."}</Text>
      <Text style={typography.body}>Lý do: {reason.trim()}</Text>
      <Button label="Xác nhận thực hiện" variant="destructive" loading={busy} onPress={() => { void submit(); }} />
    </Sheet>
  </Screen>;
}
