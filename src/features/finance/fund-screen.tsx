import { blobDataUrl, privateFileName } from "@/shared/files/private-file-model";
import { presentPrivateFile } from "@/shared/files/private-file";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/features/auth/session/session-provider";
import { collectPages } from "@/features/trips/api/pagination";
import type { Membership, Trip } from "@/features/trips/types";
import { ApiError } from "@/shared/api/api-client";
import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { OperationFeedback } from "@/shared/operations/operation-feedback";
import { operationCommitted } from "@/shared/operations/controller";
import { useTripOperation } from "@/shared/operations/use-trip-operation";
import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FadeInView, Heading, Notice, Progress, ResourceFeedback, SectionLink, Segments, StatusBadge, ui } from "@/shared/ui/journal";
import { Hint } from "@/shared/ui/hint";
import { Wolfi } from "@/shared/ui/carto/wolfi";
import { Avatar, AvatarStack, heroGradient, IconTile } from "./visuals";
import { PastelIcon } from "@/shared/ui/pastel";
import { Screen } from "@/shared/ui/screen";
import { financeCommands } from "./api";
import { ClosureSheet } from "./components/closure-sheet";
import { userNamer } from "../trips/model/member-name";
import { FinanceForm, type FinanceFormSpec } from "./components/finance-form";
import { InstructionSheet } from "./components/instruction-sheet";
import { QrImage } from "./components/qr-image";
import { resolveVietQrBank } from "./vietqr-banks";
import { PaymentQrEntry } from "@/features/payments/components/payment-qr-entry";
import { historyTimeLabel as timeAt } from "./history-labels";
import { PagedRecords } from "./components/paged-records";
import { actionLabels, budgetForm, closureActionForm, closureForm, contributionForm, contributionRequestEditForm, contributionRequestForm, destinationForm, enableForm, expenseActionForm, expenseForm, handoverActionForm, handoverCreateForm, refundActionForm, refundForm, refundVerifierForm } from "./forms";
import { contributionActions, expenseActions, financeActor, money, refundActions, refundConfirmer, statusLabels, type RefundContext } from "./model";
import type { Destination, Fund, FinanceCollections, HolderHandover } from "./types";

/** Receiving QR (no amount/reference) for a VietQR destination whose details the viewer can already see. */
function destinationQrUrl(row: Destination): string | undefined {
  const bin = row.bank_code ? resolveVietQrBank(row.bank_code)?.bin : undefined;
  if (!bin || !row.account_number || !/^[\dA-Za-z]{1,19}$/.test(row.account_number)) return undefined;
  const url = new URL(`https://img.vietqr.io/image/${bin}-${row.account_number}-compact2.svg`);
  if (row.account_name) url.searchParams.set("accountName", row.account_name);
  return url.href;
}

type Tab = "overview" | "handovers" | keyof FinanceCollections;
const tabs: { value: Tab; label: string }[] = [
  { value: "overview", label: "Tổng quan" }, { value: "contributions", label: "Đóng góp" },
  { value: "contribution-requests", label: "Đợt góp" }, { value: "expenses", label: "Khoản chi" },
  { value: "refunds", label: "Hoàn tiền" }, { value: "transactions", label: "Lịch sử" },
  { value: "handovers", label: "Bàn giao" }, { value: "closures", label: "Đóng quỹ" },
];
const confirmationModes: Record<string, string> = {
  RECIPIENT: "Người nhận tự xác nhận",
  OWNER: "Chủ nhóm kiểm chứng thay người nhận (người nhận là người giữ quỹ)",
  ASSIGNED_MEMBER: "Thành viên được chỉ định kiểm chứng độc lập",
  SELF_UNVERIFIED: "Tự xác nhận — chuyến chỉ có một thành viên",
};
const handoverStatus: Record<HolderHandover["status"], string> = {
  NOMINATED: "Chờ người được đề cử đồng ý", ACCEPTED: "Chờ hai bên xác nhận", COMPLETED: "Đã hoàn tất", CANCELLED: "Đã hủy",
};

/** Re-fetches by expense ID and never exposes an object key or bearer-token URL. */
function ExpenseReceipt({ expenseId }: { expenseId: string }) {
  const api = useApi();
  const [state, setState] = useState<{ uri?: string; blob?: Blob; message?: string; loading?: boolean }>({});
  async function load() {
    setState({ loading: true });
    try {
      const blob = await api.finance.expenseReceipt(expenseId);
      privateFileName(blob, "receipt");
      const uri = blob.type === "application/pdf" ? undefined : await blobDataUrl(blob);
      setState({ blob, uri });
    } catch (cause) {
      setState({ message: cause instanceof ApiError && cause.status === 404 ? "Không tìm thấy chứng từ (có thể đã được thay)." : "Không tải được chứng từ; thử lại." });
    }
  }
  async function present(mode: "preview" | "share") {
    if (!state.blob || state.loading) return;
    setState(old => ({ ...old, loading: true, message: undefined }));
    try { await presentPrivateFile(state.blob, "wolfari-receipt", mode); }
    catch { setState(old => ({ ...old, message: "Không mở được tệp. Thử tải lại hoặc chọn ứng dụng khác." })); }
    finally { setState(old => ({ ...old, loading: false })); }
  }
  return <View style={ui.stack}>
    {!state.blob && <Button label={state.loading ? "Đang tải chứng từ…" : "Xem chứng từ"} compact variant="soft" disabled={state.loading} onPress={() => { void load(); }} />}
    {state.uri && <Image source={{ uri: state.uri }} style={styles.receiptImage} resizeMode="contain" accessibilityLabel="Ảnh chứng từ khoản chi" />}
    {state.blob && <>
      {state.blob.type === "application/pdf" && <Button label="Mở PDF chứng từ" compact variant="soft" disabled={state.loading} onPress={() => { void present("preview"); }} />}
      <Button label="Tải / chia sẻ chứng từ" compact variant="soft" disabled={state.loading} onPress={() => { void present("share"); }} />
      <Button label="Ẩn chứng từ" compact variant="text" disabled={state.loading} onPress={() => setState({})} />
    </>}
    {state.message && <Text style={typography.footnote}>{state.message}</Text>}
  </View>;
}
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
  const budgetRatio = fund?.budget_amount && BigInt(fund.budget_amount) > 0n
    ? Number((BigInt(fund.current_balance) * 1000n) / BigInt(fund.budget_amount)) / 10
    : undefined;
  return <Screen title="Quỹ nhóm" tab="trips" onRefresh={() => { void reload(); }} refreshing={resource.loading && !!resource.data}>
    <Heading title="Quỹ của chuyến đi" subtitle={trip?.name ?? "Thu chi minh bạch, cùng nhau đối chiếu"} aside={<PastelIcon icon="wallet" tone="mint" />} />
    <OperationFeedback operation={operation} onFinish={finish} finishLabel="Tải lại quỹ" />
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
    {trip && <>
      {fund ? <>
        <View style={styles.heroCard}>
          <LinearGradient pointerEvents="none" colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={ui.recordHeader}>
            <StatusBadge status={fund.status} label={statusLabels[fund.status]} />
            <View style={styles.holderChip}>
              <Text style={typography.footnote}>Người giữ quỹ: {who(fund.holder_user_id)}</Text>
            </View>
          </View>
          <View style={ui.recordHeader}>
            <View style={[styles.balanceHero, ui.flex]}>
              <Text style={[typography.footnote, styles.onHero]}>Số dư đã ghi nhận</Text>
              <Text selectable style={[typography.largeTitle, styles.onHero]}>{money(fund.current_balance)}</Text>
              <Text style={[typography.headline, styles.onHero]}>{Number(fund.current_balance) > 0 ? "Quỹ đang rủng rỉnh ✨" : "Quỹ còn trống, rủ cả nhóm góp nào 👋"}</Text>
            </View>
            <Wolfi pose={Number(fund.current_balance) > 0 ? "happy" : "wink"} size={84} />
          </View>
          <View style={styles.metricsRow}>
            <View style={[styles.metricTile, { backgroundColor: "rgba(255,255,255,0.85)" }]}>
              <Text style={typography.headline}>Khả dụng: {money(fund.available_balance)}</Text>
            </View>
            {/* Only shown while money is actually reserved; a permanent "0 ₫" tile is noise. */}
            {Number(fund.reserved_refund) > 0 && <View style={[styles.metricTile, { backgroundColor: colors.fill }]}>
              <Text style={typography.body}>Giữ chỗ hoàn tiền: {money(fund.reserved_refund)}</Text>
            </View>}
          </View>
          {!!members.data?.length && <AvatarStack names={members.data.filter(member => !member.left_at).map(member => who(member.user_id))} caption={`${members.data.filter(member => !member.left_at).length} người chung quỹ`} />}
          {fund.budget_amount !== null && fund.budget_amount !== undefined && <View style={styles.budgetSection}>
            <View style={ui.recordHeader}>
              <Text style={[typography.body, styles.onHero]}>Ngân sách dự kiến: {money(fund.budget_amount)}</Text>
              {budgetRatio !== undefined && <Text style={[typography.footnote, styles.onHero]}>{Math.min(999, Math.round(budgetRatio))}%</Text>}
            </View>
            {budgetRatio !== undefined && <Progress done={Math.min(100, Math.max(0, budgetRatio))} total={100} />}
          </View>}
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
      {(!fund || tab === "overview") && <>
      <PaymentQrEntry key={tripId} />
      <Hint title="Quỹ hoạt động thế nào?" points={["Tiền vào thẳng tài khoản người giữ quỹ.", "App chỉ ghi sổ, không tự chuyển tiền.", "Chủ nhóm tạo yêu cầu góp; người giữ quỹ xác nhận.", "MoMo đang ở chế độ thử nghiệm."]} />
      <SectionLink title="Bản nháp dự trù riêng" subtitle="Khoản dự kiến, chưa ghi sổ" icon="edit" onPress={() => router.push({ pathname: "/trip/[id]/fund-drafts", params: { id: tripId } })} />
      <SectionLink title="Công cụ quỹ mở rộng" subtitle="Ghi chú, lịch sử, MoMo, đối soát" icon="wallet" onPress={() => router.push({ pathname: "/trip/[id]/fund-tools", params: { id: tripId } })} />
      </>}
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
  const [qrId, setQrId] = useState<string>(), [qrConsent, setQrConsent] = useState(false), [qrFailed, setQrFailed] = useState(false);
  // Consent covers one account's data only: opening another row asks again.
  const showQr = (id?: string) => { setQrId(id); setQrConsent(false); setQrFailed(false); };
  return <FadeInView>
    {actor.owner && actor.writable && <View style={ui.actionRow}>
      <Button label="Cập nhật ngân sách" compact variant="soft" disabled={locked} onPress={() => open(budgetForm(fund))} />
      <Button label="Thêm tài khoản nhận" compact variant="soft" disabled={locked} onPress={() => open(destinationForm(fund))} />
    </View>}
    <Text accessibilityRole="header" style={typography.section}>Tài khoản nhận tiền</Text>
    <ResourceFeedback {...destinations} hasData={!!destinations.data} onRetry={() => { void destinations.reload(); }} />
    {destinations.data?.map(row => { const qrUrl = row.destination_type === "VIETQR" && row.active ? destinationQrUrl(row) : undefined; return <View key={row.id} style={ui.record}>
      <View style={ui.row}>
        <IconTile icon="wallet" tone={row.destination_type === "VIETQR" ? colors.mint : colors.fill} />
        <Text style={[typography.headline, ui.flex]}>{row.destination_type === "VIETQR" ? "VietQR" : "MoMo · SANDBOX"}{row.is_default ? " · Mặc định" : ""}</Text>
      </View>
      <View style={ui.recordHeader}>
        <StatusBadge status={row.active && row.confirmed_by_holder_at ? "CONFIRMED" : row.active ? "PENDING" : "CLOSED"} label={`${row.active ? "Đang hoạt động" : "Đã tắt"} · ${row.confirmed_by_holder_at ? "Người giữ quỹ đã xác nhận" : "Chưa được người giữ quỹ xác nhận"}`} />
      </View>
      {row.account_number ? <>
        <Text selectable style={typography.body}>{row.bank_code} · {row.account_number}</Text>
        <Text selectable style={typography.body}>{row.account_name}</Text>
      </> : row.momo_phone ? <Text selectable style={typography.body}>{row.momo_phone}</Text> : <Text style={typography.footnote}>Số tài khoản có trong mã QR của khoản góp của bạn.</Text>}
      {qrUrl && (qrId === row.id ? <>
        {qrConsent ? <QrImage url={qrUrl} label={`Mã QR nhận tiền ${row.bank_code ?? ""} ${row.account_number ?? ""}`} onError={() => setQrFailed(true)} /> : <>
          <Notice>Để tải ảnh QR nhận tiền, ngân hàng, số tài khoản và tên người nhận sẽ được gửi đến Casso (img.vietqr.io). Chỉ tiếp tục nếu bạn đồng ý.</Notice>
          <Button label="Đồng ý tải ảnh QR" compact variant="soft" onPress={() => setQrConsent(true)} />
        </>}
        {qrFailed && <Feedback message="Không tải được ảnh QR. Kiểm tra mạng; thông tin tài khoản vẫn hiển thị ở trên." />}
        {qrConsent && <Hint title="Mã này dùng khi nào?" points={["Mã không kèm số tiền hay nội dung; người chuyển tự nhập.", "Để khớp đúng khoản góp, dùng mã QR trong tab Đóng góp."]} />}
        <Button label="Ẩn mã QR" compact variant="text" onPress={() => showQr(undefined)} />
      </> : <Button label="Xem mã QR nhận tiền" compact accessibilityLabel={`Xem mã QR nhận tiền ${row.bank_code ?? ""} ${row.account_number ?? ""}`} variant="soft" onPress={() => showQr(row.id)} />)}
      {actor.writable && !destinations.error && <View style={ui.actionRow}>
        {actor.holder && row.active && !row.confirmed_by_holder_at && <Button label="Xác nhận tài khoản nhận" compact accessibilityLabel={`Xác nhận tài khoản ${row.bank_code ?? "ngân hàng"} ${row.account_number ?? row.momo_phone ?? row.account_name ?? ""}`} disabled={locked || destinations.loading} onPress={() => open({ title: "Xác nhận tài khoản nhận", description: `${row.bank_code ?? (row.destination_type === "VIETQR" ? "VietQR" : "MoMo")} · ${row.account_number ?? row.momo_phone ?? ""} · ${row.account_name ?? ""}. Tôi là người giữ quỹ và đã kiểm tra đúng thông tin. Xác nhận này không phải xác minh của ngân hàng.`, build: () => financeCommands.confirmDestination(fund, row) })} />}
        {actor.owner && <>
          {row.destination_type === "VIETQR" && <Button label="Sửa tài khoản nhận" compact variant="soft" disabled={locked || destinations.loading} onPress={() => open(destinationForm(fund, row))} />}
          <Button label={row.active ? "Tắt tài khoản nhận" : "Bật lại tài khoản nhận"} compact variant="soft" disabled={locked || destinations.loading} onPress={() => open({ title: row.active ? "Tắt tài khoản nhận" : "Bật lại tài khoản nhận", description: "Không sửa tài khoản đã chốt trên các khoản góp cũ. Bật lại sẽ yêu cầu người giữ quỹ xác nhận lại.", build: () => financeCommands.destination(fund, { active: !row.active, is_default: false }, row) })} />
        </>}
      </View>}
    </View>; })}
  </FadeInView>;
}

function FundRecords({ fund, trip, userId, locked, open, who, tab, members, onInstruction, onClosure }: Context & {
  tab: Exclude<Tab, "overview">; members: Membership[]; onInstruction(id: string): void; onClosure(id: string): void;
}) {
  const api = useApi();
  const actor = financeActor(fund, userId, trip.current_membership.role === "OWNER", trip.lifecycle === "ARCHIVED");
  const active = members.filter(member => !member.left_at);
  const refundContext: RefundContext = {
    holderUserId: fund.holder_user_id,
    ownerUserId: active.find(member => member.role === "OWNER")?.user_id ?? (actor.owner ? userId : null),
    activeMemberCount: active.length,
  };
  const handovers = useResource(useCallback((signal: AbortSignal) => api.finance.handovers(fund.id, signal), [api, fund.id]), tab === "handovers");
  const openHandover = handovers.data?.find(row => row.status === "NOMINATED" || row.status === "ACCEPTED");
  const contributions = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "contributions", cursor, signal), [api, fund.id]);
  const requests = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "contribution-requests", cursor, signal), [api, fund.id]);
  const expenses = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "expenses", cursor, signal), [api, fund.id]);
  const refunds = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "refunds", cursor, signal), [api, fund.id]);
  const transactions = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "transactions", cursor, signal), [api, fund.id]);
  const closures = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "closures", cursor, signal), [api, fund.id]);
  const destinations = useResource(useCallback((signal: AbortSignal) => api.finance.destinations(fund.id, signal), [api, fund.id]), actor.owner && (tab === "contributions" || tab === "contribution-requests"));
  const status = (value: string) => <StatusBadge status={value} label={statusLabels[value]} />;
  const contribute = actor.owner && actor.writable && <>
    <ResourceFeedback {...destinations} hasData={!!destinations.data} onRetry={() => { void destinations.reload(); }} />
    <Button label="Tạo yêu cầu đóng góp" disabled={locked || !members.length || !destinations.data || destinations.loading || !!destinations.error} onPress={() => open(contributionRequestForm(fund, members, destinations.data!, userId, trip.timezone))} />
  </>;
  return <View style={ui.stack}>
    {tab === "contributions" && <>{contribute}<PagedRecords title="đóng góp" load={contributions} render={row => <>
      <View style={ui.recordHeader}>
        <Text style={typography.headline}>{money(row.amount)}</Text>
        {status(row.status)}
      </View>
      <View style={ui.row}>
        <Avatar name={who(row.member_user_id)} />
        <Text style={[typography.body, ui.flex]}>{row.member_user_id === userId ? "Khoản đóng của bạn" : who(row.member_user_id)}</Text>
      </View>
      {row.waived_reason && <Text style={typography.body}>Lý do miễn: {row.waived_reason}</Text>}
      {row.cancelled_reason && <Text style={typography.body}>Lý do hủy: {row.cancelled_reason}</Text>}
      {row.rejected_reason && <Text style={typography.body}>Lý do từ chối gần nhất: {row.rejected_reason}</Text>}
      <View style={ui.actionRow}>
        {actor.writable && row.member_user_id === userId && row.status === "PENDING" && <Button label="Mã QR chuyển khoản" compact variant="soft" disabled={locked} onPress={() => onInstruction(row.id)} />}
        {contributionActions(row, actor).map(action => <Button key={action} label={actionLabels[action]} compact accessibilityLabel={`${actionLabels[action]} · ${who(row.member_user_id)} · ${money(row.amount)}`} variant="soft" disabled={locked} onPress={() => open(contributionForm(fund, row, action, who))} />)}
      </View>
    </>} /></>}
    {tab === "contribution-requests" && <>{contribute}<PagedRecords title="đợt góp" load={requests} render={row => <>
      <View style={ui.recordHeader}>
        <Text style={typography.headline}>{row.title}</Text>
        {status(row.status)}
      </View>
      {row.note && <Text style={typography.body}>{row.note}</Text>}
      <Text style={typography.footnote}>{row.due_at ? `Hạn: ${timeAt(row.due_at, trip.timezone)}` : "Không đặt hạn"}</Text>
      {!!row.contributions?.length && <>
        <View style={ui.recordHeader}>
          <Text style={typography.footnote}>Đã góp {row.contributions.filter(item => item.status === "CONFIRMED").length}/{row.contributions.length} người</Text>
        </View>
        <Progress done={row.contributions.filter(item => item.status === "CONFIRMED").length} total={row.contributions.length} />
      </>}
      {row.contributions?.map(item => <View key={item.id} style={ui.row}>
        <Avatar name={who(item.member_user_id)} />
        <Text style={[typography.body, ui.flex]}>{who(item.member_user_id)} · {money(item.amount)} · {statusLabels[item.status]}</Text>
      </View>)}
      {actor.owner && actor.writable && row.status === "OPEN" && <View style={ui.actionRow}><Button label="Sửa đợt đóng góp" compact accessibilityLabel={`Sửa đợt đóng góp ${row.title}`} variant="soft" disabled={locked} onPress={() => open(contributionRequestEditForm(fund, row, trip.timezone))} /></View>}
    </>} /></>}
    {tab === "expenses" && <>
      {actor.writable && <Button label="Tạo khoản chi" disabled={locked} onPress={() => open(expenseForm(fund))} />}
      <PagedRecords title="khoản chi" load={expenses} render={row => <>
        <View style={ui.recordHeader}>
          <Text style={typography.headline}>{row.title} · {money(row.amount)}</Text>
          {status(row.status)}
        </View>
        {!!row.category && <Text style={typography.footnote}>{row.category}</Text>}
        {!!row.description && <Text style={typography.body}>{row.description}</Text>}
        {!!row.rejected_reason && <Text style={typography.body}>Lý do từ chối: {row.rejected_reason}</Text>}
        {row.receipt_available && <ExpenseReceipt expenseId={row.id} />}
        <View style={ui.actionRow}>
          {expenseActions(row, actor).map(action => <Button key={action} label={actionLabels[action]} compact accessibilityLabel={`${actionLabels[action]} ${row.title}`} variant="soft" disabled={locked} onPress={() => open(action === "edit" ? expenseForm(fund, row) : expenseActionForm(fund, row, action, trip.timezone))} />)}
        </View>
      </>} />
    </>}
    {tab === "refunds" && <>
      {actor.owner && actor.writable && <Button label="Tạo hoàn tiền" disabled={locked || !members.length} onPress={() => open(refundForm(fund, members, userId))} />}
      <PagedRecords title="hoàn tiền" load={refunds} render={row => <>
        <View style={ui.recordHeader}>
          <Text style={typography.headline}>{money(row.amount)} · {row.member_user_id === userId ? "Hoàn cho bạn" : who(row.member_user_id)}</Text>
          {status(row.status)}
        </View>
        <Text style={typography.body}>{row.reason}</Text>
        {row.nonreceipt_confirmed_at && <Notice>Người nhận đã báo chưa nhận tiền.</Notice>}
        {row.reversal_requested_at && <Notice>Đã yêu cầu đảo hoàn tiền · {row.reversal_consented_at ? "Người nhận đã đồng ý" : "Chờ người nhận đồng ý"}{row.reversal_reason ? ` · Lý do: ${row.reversal_reason}` : ""}</Notice>}
        {(row.status === "PENDING" || row.status === "HOLDER_REPORTED") && (() => {
          const confirmer = refundConfirmer(row, refundContext);
          return <Text style={typography.footnote}>{confirmer ? `Người xác nhận đã nhận: ${confirmer === userId ? "Bạn" : who(confirmer)}` : "Cần chủ nhóm chỉ định người kiểm chứng trước khi xác nhận."}</Text>;
        })()}
        {row.confirmation_mode && <Text style={typography.footnote}>Cách xác nhận: {confirmationModes[row.confirmation_mode] ?? row.confirmation_mode}</Text>}
        <View style={ui.actionRow}>
          {refundActions(row, actor, refundContext).map(action => <Button key={action} label={action === "assign-verifier" && row.verifier_user_id ? "Đổi người kiểm chứng" : actionLabels[action]} compact accessibilityLabel={`${actionLabels[action]} · ${who(row.member_user_id)} · ${money(row.amount)}`} variant="soft" disabled={locked} onPress={() => open(action === "assign-verifier" ? refundVerifierForm(fund, row, members, userId, who) : refundActionForm(fund, row, action, who))} />)}
        </View>
      </>} />
    </>}
    {tab === "transactions" && <PagedRecords title="giao dịch" load={transactions} render={row => <>
      <View style={ui.recordHeader}>
        <View style={ui.row}>
          <IconTile icon={row.direction === "IN" ? "plus" : "wallet"} tone={row.direction === "IN" ? colors.mint : colors.fill} />
          <Text style={typography.headline}>{row.direction === "IN" ? "+" : "−"}{money(row.amount)}</Text>
        </View>
        <StatusBadge status={row.direction === "IN" ? "CONFIRMED" : "DRAFT"} label={{ CONTRIBUTION: "Đóng góp", EXPENSE: "Khoản chi", REFUND: "Hoàn tiền", REVERSAL: "Bút toán đảo" }[row.transaction_type]} />
      </View>
      <Text style={typography.footnote}>#{row.sequence} · {timeAt(row.created_at, trip.timezone)}</Text>
      <Text style={typography.body}>Số dư sau: {money(row.balance_after)}</Text>
      {row.reason && <Text style={typography.body}>{row.reason}</Text>}
    </>} />}
    {tab === "handovers" && <>
      <Text style={typography.body}>Người giữ quỹ hiện tại: {fund.holder_user_id === userId ? "Bạn" : who(fund.holder_user_id)}. Bàn giao chỉ đổi người chịu trách nhiệm; tiền được giao nhận bên ngoài ứng dụng và số dư không đổi.</Text>
      {actor.owner && actor.writable && !openHandover && !handovers.loading && <Button label="Đề cử người giữ quỹ mới" disabled={locked || active.length < 2} onPress={() => open(handoverCreateForm(fund, members, userId))} />}
      <ResourceFeedback {...handovers} hasData={!!handovers.data} onRetry={() => { void handovers.reload(); }} />
      {handovers.data && !handovers.data.length && <Text style={typography.body}>Chưa có lần bàn giao nào.</Text>}
      {handovers.data?.map(row => {
        const old = row.old_holder_user_id === userId, next = row.new_holder_user_id === userId, party = actor.owner || old || next;
        const pending = row.status === "NOMINATED" || row.status === "ACCEPTED";
        const actions: ("accept" | "refresh-snapshot" | "confirm" | "cancel")[] = [];
        if (actor.writable && pending) {
          if (row.status === "NOMINATED" && next) actions.push("accept");
          if (row.status === "ACCEPTED" && row.snapshot_stale && party) actions.push("refresh-snapshot");
          if (row.status === "ACCEPTED" && !row.snapshot_stale && ((old && !row.old_holder_confirmed_at) || (next && !row.new_holder_confirmed_at))) actions.push("confirm");
          if (party) actions.push("cancel");
        }
        return <View key={row.id} style={ui.record}>
          <View style={ui.recordHeader}>
            <Text style={typography.headline}>{who(row.old_holder_user_id)} → {who(row.new_holder_user_id)}</Text>
            <StatusBadge status={row.status === "COMPLETED" ? "CONFIRMED" : row.status === "CANCELLED" ? "CANCELLED" : "PENDING"} label={handoverStatus[row.status]} />
          </View>
          {row.snapshot && <Text style={typography.body}>Số dư khi chốt: {money(row.snapshot.current_balance)} · Có thể chi: {money(row.snapshot.available_balance)}</Text>}
          {row.status === "ACCEPTED" && row.snapshot_stale && <Notice>Số liệu quỹ đã thay đổi sau khi chốt. Cập nhật bản chốt rồi hai bên xác nhận lại.</Notice>}
          {row.status === "ACCEPTED" && !row.snapshot_stale && <Text style={typography.footnote}>Người giữ quỹ cũ: {row.old_holder_confirmed_at ? "đã xác nhận" : "chưa xác nhận"} · Người giữ quỹ mới: {row.new_holder_confirmed_at ? "đã xác nhận" : "chưa xác nhận"}</Text>}
          {row.cancellation_reason && <Text style={typography.footnote}>Lý do hủy: {row.cancellation_reason}</Text>}
          {!!actions.length && <View style={ui.actionRow}>
            {actions.map(action => { const spec = handoverActionForm(fund, row, action, who, userId); return <Button key={action} label={spec.title} compact variant="soft" disabled={locked} onPress={() => open(spec)} />; })}
          </View>}
        </View>;
      })}
    </>}
    {tab === "closures" && <>
      {actor.owner && actor.writable && <Button label="Yêu cầu đóng quỹ" disabled={locked} onPress={() => open(closureForm(fund))} />}
      <PagedRecords title="phiên đóng quỹ" load={closures} render={row => <>
        <View style={ui.recordHeader}>
          <Text style={typography.headline}>Bản chốt · {timeAt(row.requested_at, trip.timezone)}</Text>
          {status(row.status)}
        </View>
        <Text style={typography.body}>{row.confirmations.filter(item => !!item.confirmed_at).length}/{row.confirmations.length} người đã xác nhận</Text>
        {row.cancelled_reason && <Text style={typography.body}>Lý do hủy: {row.cancelled_reason}</Text>}
        <View style={ui.actionRow}>
          <Button label="Xem bản chốt" compact variant="soft" onPress={() => onClosure(row.id)} />
        </View>
      </>} />
    </>}
  </View>;
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 20,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
    gap: 14,
    overflow: "hidden",
    ...shadows.card,
  },
  holderChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  onHero: { color: colors.ink },
  balanceHero: {
    gap: 4,
    paddingVertical: 2,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    flexGrow: 1,
    flexBasis: 130,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.control,
  },
  budgetSection: {
    gap: 8,
    paddingTop: 4,
  },
  receiptImage: {
    width: "100%",
    height: 260,
    borderRadius: radii.control,
    backgroundColor: colors.fill,
  },
});
