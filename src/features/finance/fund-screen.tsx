import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useSession } from "@/features/auth/session/session-provider";
import { collectPages } from "@/features/trips/api/pagination";
import type { Membership, Trip } from "@/features/trips/types";
import { ApiError } from "@/shared/api/api-client";
import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { OperationFeedback } from "@/shared/operations/operation-feedback";
import { operationCommitted } from "@/shared/operations/controller";
import { useTripOperation } from "@/shared/operations/use-trip-operation";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Heading, Notice, ResourceFeedback, SectionLink, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { financeCommands } from "./api";
import { ClosureSheet } from "./components/closure-sheet";
import { userNamer } from "../trips/model/member-name";
import { FinanceForm, type FinanceFormSpec } from "./components/finance-form";
import { InstructionSheet } from "./components/instruction-sheet";
import { PagedRecords } from "./components/paged-records";
import { actionLabels, budgetForm, closureActionForm, closureForm, contributionForm, contributionRequestForm, destinationForm, enableForm, expenseActionForm, expenseForm, refundActionForm, refundForm } from "./forms";
import { contributionActions, expenseActions, financeActor, money, refundActions, statusLabels } from "./model";
import type { Fund, FinanceCollections } from "./types";

type Tab = "overview" | keyof FinanceCollections;
const tabs: { value: Tab; label: string }[] = [
  { value: "overview", label: "Tổng quan" }, { value: "contributions", label: "Đóng góp" },
  { value: "contribution-requests", label: "Đợt góp" }, { value: "expenses", label: "Khoản chi" },
  { value: "refunds", label: "Hoàn tiền" }, { value: "transactions", label: "Lịch sử" }, { value: "closures", label: "Đóng quỹ" },
];
export default function FundScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  // Scope all UI/form state to both account and trip when the same route is reused.
  return <FundWorkspace key={`${profile?.id}:${id}`} tripId={id} userId={profile?.id ?? ""} />;
}

function FundWorkspace({ tripId, userId }: { tripId: string; userId: string }) {
  const api = useApi(), operation = useTripOperation(tripId);
  const [tab, setTab] = useState<Tab>("overview");
  const [form, setForm] = useState<FinanceFormSpec>();
  const [instruction, setInstruction] = useState<string>();
  const [closureId, setClosureId] = useState<string>();
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(tripId)) throw new Error("Liên kết chuyến đi không hợp lệ.");
    const trip = await api.trips.get(tripId, signal);
    try {
      const fund = await api.finance.fund(tripId, signal);
      return { trip: fund ? trip : await api.trips.get(tripId, signal), fund };
    }
    catch (cause) {
      if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
      // 404 also conceals membership denial. Recheck Trip before offering setup.
      return { trip: await api.trips.get(tripId, signal), fund: null };
    }
  }, [api, tripId]), !!userId);
  const members = useResource(useCallback((signal: AbortSignal) => collectPages(cursor => api.trips.members(tripId, cursor, signal), signal), [api, tripId]), !!resource.data);
  const { trip, fund } = resource.data ?? {};
  const owner = trip?.current_membership.role === "OWNER";
  const archived = trip?.lifecycle === "ARCHIVED";
  const open = (spec: FinanceFormSpec) => { if (!operation.locked && !resource.loading && !resource.error) setForm(spec); };
  const locked = operation.locked || resource.loading || !!resource.error;
  const who = userNamer(members.data, userId);
  async function reload() { await Promise.all([resource.reload(), members.reload()]); }
  async function finish() {
    if (operation.pending?.kind === "leave" && operationCommitted(operation.pending)) router.replace("/(tabs)/trips");
    else await reload();
  }
  return <Screen title="Quỹ nhóm" tab="trips" onRefresh={() => { void reload(); }} refreshing={resource.loading && !!resource.data}>
    <Heading title="Quỹ của chuyến đi" subtitle={trip?.name ?? "Thu chi minh bạch, cùng nhau đối chiếu"} />
    <OperationFeedback operation={operation} onFinish={finish} finishLabel="Tải lại quỹ" />
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
    {trip && <>
      <Notice>Ứng dụng ghi nhận đóng góp, chi và hoàn tiền qua backend. Không tự chuyển tiền ngân hàng; chỉ xác nhận khi đã đối chiếu tiền thực tế. VietQR hiện là TEST; không dùng MoMo sandbox như thanh toán thật.</Notice>
      {fund ? <>
        <View style={ui.section}>
          <Text style={typography.footnote}>{statusLabels[fund.status]} · VND · Phiên bản {fund.finance_version}</Text>
          <Text style={typography.footnote}>Số dư đã ghi nhận</Text>
          <Text selectable style={typography.title}>{money(fund.current_balance)}</Text>
          <Text style={typography.body}>Giữ chỗ hoàn tiền: {money(fund.reserved_refund)}</Text>
          <Text style={typography.headline}>Khả dụng: {money(fund.available_balance)}</Text>
          <Text style={typography.body}>Ngân sách dự kiến: {money(fund.budget_amount)}</Text>
          <Text style={typography.footnote}>Người giữ quỹ: {who(fund.holder_user_id)}</Text>
        </View>
        {(fund.status !== "OPEN" || archived) && <Notice>{fund.status === "CLOSING" ? "Đang chốt quỹ: các giao dịch khác và thay đổi thành viên bị khóa. Mở tab Đóng quỹ để xem/xác nhận hoặc hủy phiên." : "Quỹ đã đóng hoặc chuyến đi đã lưu trữ: chỉ đọc lịch sử."}</Notice>}
        <Segments scroll items={tabs} value={tab} onChange={setTab} />
        {tab === "overview" ? <FundOverview key={`${fund.id}:${fund.finance_version}`} fund={fund} trip={trip} userId={userId} locked={locked} open={open} who={who} /> : <FundRecords key={`${fund.id}:${fund.finance_version}:${tab}`} fund={fund} trip={trip} userId={userId} tab={tab} members={members.data ?? []} locked={locked} who={who} open={open} onInstruction={setInstruction} onClosure={setClosureId} />}
        {((tab === "contributions" || tab === "contribution-requests" || tab === "refunds") && owner) && <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />}
      </> : <>
        <Notice>Chưa tìm thấy quỹ khả dụng. Nếu đã mở quỹ, hãy kiểm tra quyền hoặc cấu hình Finance Gateway trước khi tạo mới. Chỉ chủ nhóm có thể mở quỹ.</Notice>
        <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />
        {owner && !archived && <Button label="Mở quỹ nhóm" disabled={locked || !members.data || members.loading || !!members.error} onPress={() => open(enableForm(tripId, members.data!, userId))} />}
      </>}
      <SectionLink title="Bản nháp dự trù riêng" subtitle="Giữ các khoản dự kiến cũ · không ghi vào sổ quỹ" icon="edit" onPress={() => router.push({ pathname: "/trip/[id]/fund-drafts", params: { id: tripId } })} />
      <SectionLink title="Công cụ quỹ mở rộng" subtitle="Ngoài quỹ · lịch sử kiểm toán · thanh toán Sandbox · đối soát" icon="wallet" onPress={() => router.push({ pathname: "/trip/[id]/fund-tools", params: { id: tripId } })} />
    </>}
    {form && <FinanceForm spec={form} busy={operation.busy} onSubmit={operation.run} onClose={() => setForm(undefined)} />}
    {instruction && <InstructionSheet contributionId={instruction} onClose={() => setInstruction(undefined)} />}
    {closureId && <ClosureSheet closureId={closureId} owner={!!owner} userId={userId} who={who} writable={!locked && !archived} onClose={() => setClosureId(undefined)} onAction={(row, action) => { setClosureId(undefined); open(closureActionForm(row, action)); }} />}
  </Screen>;
}

type Context = { fund: Fund; trip: Trip; userId: string; locked: boolean; open(spec: FinanceFormSpec): void; who(userId: string): string };
function FundOverview({ fund, trip, userId, locked, open }: Context) {
  const api = useApi();
  const actor = financeActor(fund, userId, trip.current_membership.role === "OWNER", trip.lifecycle === "ARCHIVED");
  const destinations = useResource(useCallback((signal: AbortSignal) => api.finance.destinations(fund.id, signal), [api, fund.id]));
  return <View style={ui.stack}>
    {actor.owner && actor.writable && <>
      <Button label="Cập nhật ngân sách" variant="soft" disabled={locked} onPress={() => open(budgetForm(fund))} />
      <Button label="Thêm tài khoản nhận" variant="soft" disabled={locked} onPress={() => open(destinationForm(fund))} />
    </>}
    <Text accessibilityRole="header" style={typography.section}>Tài khoản nhận tiền</Text>
    <ResourceFeedback {...destinations} hasData={!!destinations.data} onRetry={() => { void destinations.reload(); }} />
    {destinations.data?.map(row => <View key={row.id} style={ui.record}>
      <Text style={typography.headline}>{row.destination_type === "VIETQR" ? "VietQR" : "MoMo · SANDBOX"}{row.is_default ? " · Mặc định" : ""}</Text>
      <Text style={typography.body}>{row.active ? "Đang hoạt động" : "Đã tắt"} · {row.confirmed_by_holder_at ? "Người giữ quỹ đã xác nhận" : "Chưa được người giữ quỹ xác nhận"}</Text>
      {row.account_number ? <>
        <Text selectable style={typography.body}>{row.bank_code} · {row.account_number}</Text>
        <Text selectable style={typography.body}>{row.account_name}</Text>
      </> : row.momo_phone ? <Text selectable style={typography.body}>{row.momo_phone}</Text> : <Text style={typography.footnote}>Chi tiết tài khoản chỉ dành cho chủ nhóm/người giữ quỹ. Xem chỉ dẫn của chính khoản góp để chuyển đúng tài khoản đã chốt.</Text>}
      {actor.writable && !destinations.error && <>
        {actor.holder && row.active && !row.confirmed_by_holder_at && <Button label="Xác nhận tài khoản nhận" accessibilityLabel={`Xác nhận tài khoản ${row.id.slice(0, 8)}`} disabled={locked || destinations.loading} onPress={() => open({ title: "Xác nhận tài khoản nhận", description: `${row.bank_code ?? row.destination_type} · ${row.account_number ?? row.momo_phone ?? ""} · ${row.account_name ?? ""}. Tôi là người giữ quỹ và đã kiểm tra đúng thông tin. Xác nhận này không phải xác minh của ngân hàng.`, build: () => financeCommands.confirmDestination(fund, row) })} />}
        {actor.owner && <>
          {row.destination_type === "VIETQR" && <Button label="Sửa tài khoản nhận" variant="soft" disabled={locked || destinations.loading} onPress={() => open(destinationForm(fund, row))} />}
          <Button label={row.active ? "Tắt tài khoản nhận" : "Bật lại tài khoản nhận"} variant="soft" disabled={locked || destinations.loading} onPress={() => open({ title: row.active ? "Tắt tài khoản nhận" : "Bật lại tài khoản nhận", description: "Không sửa tài khoản đã chốt trên các khoản góp cũ. Bật lại sẽ yêu cầu người giữ quỹ xác nhận lại.", build: () => financeCommands.destination(fund, { active: !row.active, is_default: false }, row) })} />
        </>}
      </>}
    </View>)}
    {actor.writable && <Notice>Chủ nhóm cấu hình quỹ và phát hành yêu cầu. Người giữ quỹ xác nhận nhận tiền/chi. Người được hoàn tự xác nhận nhận đủ. Quyền chỉnh kế hoạch không thay thế quyền tài chính.</Notice>}
  </View>;
}

function FundRecords({ fund, trip, userId, locked, open, who, tab, members, onInstruction, onClosure }: Context & {
  tab: keyof FinanceCollections; members: Membership[]; onInstruction(id: string): void; onClosure(id: string): void;
}) {
  const api = useApi();
  const actor = financeActor(fund, userId, trip.current_membership.role === "OWNER", trip.lifecycle === "ARCHIVED");
  const contributions = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "contributions", cursor, signal), [api, fund.id]);
  const requests = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "contribution-requests", cursor, signal), [api, fund.id]);
  const expenses = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "expenses", cursor, signal), [api, fund.id]);
  const refunds = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "refunds", cursor, signal), [api, fund.id]);
  const transactions = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "transactions", cursor, signal), [api, fund.id]);
  const closures = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "closures", cursor, signal), [api, fund.id]);
  const destinations = useResource(useCallback((signal: AbortSignal) => api.finance.destinations(fund.id, signal), [api, fund.id]), actor.owner && (tab === "contributions" || tab === "contribution-requests"));
  const status = (value: string) => <Text style={typography.footnote}>{statusLabels[value] ?? value}</Text>;
  const contribute = actor.owner && actor.writable && <>
    <ResourceFeedback {...destinations} hasData={!!destinations.data} onRetry={() => { void destinations.reload(); }} />
    <Button label="Tạo yêu cầu đóng góp" disabled={locked || !members.length || !destinations.data || destinations.loading || !!destinations.error} onPress={() => open(contributionRequestForm(fund, members, destinations.data!, userId))} />
  </>;
  return <View style={ui.stack}>
    {tab === "contributions" && <>{contribute}<PagedRecords title="đóng góp" load={contributions} render={row => <>
      <Text style={typography.headline}>{money(row.amount)}</Text>
      <Text style={typography.body}>{row.member_user_id === userId ? "Khoản đóng của bạn" : who(row.member_user_id)}</Text>
      {status(row.status)}
      {row.waived_reason && <Text style={typography.body}>Lý do miễn: {row.waived_reason}</Text>}
      {row.cancelled_reason && <Text style={typography.body}>Lý do hủy: {row.cancelled_reason}</Text>}
      {actor.writable && row.member_user_id === userId && row.status === "PENDING" && <Button label="Xem VietQR TEST" variant="soft" disabled={locked} onPress={() => onInstruction(row.id)} />}
      {contributionActions(row, actor).map(action => <Button key={action} label={actionLabels[action]} accessibilityLabel={`${actionLabels[action]} ${row.id.slice(0, 8)}`} variant="soft" disabled={locked} onPress={() => open(contributionForm(fund, row, action, who))} />)}
    </>} /></>}
    {tab === "contribution-requests" && <>{contribute}<PagedRecords title="đợt góp" load={requests} render={row => <>
      <Text style={typography.headline}>{row.title}</Text>{status(row.status)}
      {row.note && <Text style={typography.body}>{row.note}</Text>}
      <Text style={typography.footnote}>{row.due_at ? `Hạn: ${row.due_at}` : "Không đặt hạn"}</Text>
      {row.contributions?.map(item => <Text key={item.id} style={typography.body}>{who(item.member_user_id)} · {money(item.amount)} · {statusLabels[item.status]}</Text>)}
    </>} /></>}
    {tab === "expenses" && <>
      {actor.writable && <Button label="Tạo khoản chi" disabled={locked} onPress={() => open(expenseForm(fund))} />}
      <PagedRecords title="khoản chi" load={expenses} render={row => <>
        <Text style={typography.headline}>{row.title} · {money(row.amount)}</Text>{status(row.status)}
        {!!row.category && <Text style={typography.footnote}>{row.category}</Text>}
        {!!row.description && <Text style={typography.body}>{row.description}</Text>}
        {!!row.rejected_reason && <Text style={typography.body}>Lý do từ chối: {row.rejected_reason}</Text>}
        {row.receipt_available && <Notice>Đã gắn chứng từ riêng tư. Backend hiện chưa trả mã tải trong danh sách; chưa thể mở chứng từ từ bản ghi này.</Notice>}
        {expenseActions(row, actor).map(action => <Button key={action} label={actionLabels[action]} accessibilityLabel={`${actionLabels[action]} ${row.title}`} variant="soft" disabled={locked} onPress={() => open(action === "edit" ? expenseForm(fund, row) : expenseActionForm(fund, row, action, trip.timezone))} />)}
      </>} />
    </>}
    {tab === "refunds" && <>
      {actor.owner && actor.writable && <Button label="Tạo hoàn tiền" disabled={locked || !members.length} onPress={() => open(refundForm(fund, members, userId))} />}
      <PagedRecords title="hoàn tiền" load={refunds} render={row => <>
        <Text style={typography.headline}>{money(row.amount)} · {row.member_user_id === userId ? "Hoàn cho bạn" : who(row.member_user_id)}</Text>{status(row.status)}
        <Text style={typography.body}>{row.reason}</Text>
        {row.nonreceipt_confirmed_at && <Notice>Người nhận đã báo chưa nhận tiền.</Notice>}
        {row.reversal_requested_at && <Notice>Đã yêu cầu đảo hoàn tiền · {row.reversal_consented_at ? "Người nhận đã đồng ý" : "Chờ người nhận đồng ý"}</Notice>}
        {refundActions(row, actor).map(action => <Button key={action} label={actionLabels[action]} accessibilityLabel={`${actionLabels[action]} ${row.id.slice(0, 8)}`} variant="soft" disabled={locked} onPress={() => open(refundActionForm(fund, row, action, who))} />)}
      </>} />
    </>}
    {tab === "transactions" && <PagedRecords title="giao dịch" load={transactions} render={row => <>
      <Text style={typography.headline}>{row.direction === "IN" ? "+" : "−"}{money(row.amount)}</Text>
      <Text style={typography.body}>{{ CONTRIBUTION: "Đóng góp", EXPENSE: "Khoản chi", REFUND: "Hoàn tiền", REVERSAL: "Bút toán đảo" }[row.transaction_type]}</Text>
      <Text style={typography.footnote}>#{row.sequence} · {row.created_at}</Text>
      <Text style={typography.body}>Số dư sau: {money(row.balance_after)}</Text>
      {row.reason && <Text style={typography.body}>{row.reason}</Text>}
      {row.reversal_of_id && <Text selectable style={typography.footnote}>Đảo giao dịch: {row.reversal_of_id}</Text>}
    </>} />}
    {tab === "closures" && <>
      {actor.owner && actor.writable && <Button label="Yêu cầu đóng quỹ" disabled={locked} onPress={() => open(closureForm(fund))} />}
      <PagedRecords title="phiên đóng quỹ" load={closures} render={row => <>
        <Text style={typography.headline}>Bản chốt · {row.requested_at}</Text>{status(row.status)}
        <Text style={typography.body}>{row.confirmations.filter(item => !!item.confirmed_at).length}/{row.confirmations.length} người đã xác nhận</Text>
        {row.cancelled_reason && <Text style={typography.body}>Lý do hủy: {row.cancelled_reason}</Text>}
        <Button label="Xem bản chốt" variant="soft" onPress={() => onClosure(row.id)} />
      </>} />
    </>}
  </View>;
}
