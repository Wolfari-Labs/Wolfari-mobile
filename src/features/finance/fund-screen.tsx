import { DesignPopup } from "@/shared/ui/design-popup";
import { blobDataUrl, privateFileName } from "@/shared/files/private-file-model";
import { presentPrivateFile } from "@/shared/files/private-file";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/features/auth/session/session-provider";
import { collectPages } from "@/features/trips/api/pagination";
import type { Membership, Trip } from "@/features/trips/types";
import { ApiError } from "@/shared/api/api-client";
import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { useLiveVersion } from "@/shared/hooks/use-live-version";
import { OperationFeedback } from "@/shared/operations/operation-feedback";
import { operationCommitted } from "@/shared/operations/controller";
import { useTripOperation } from "@/shared/operations/use-trip-operation";
import { colors, fonts, gradients, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { CardIcon, ClayButton, ClayIconButton, claySubtitle, SettingCard } from "@/shared/ui/setting-card";
import { Sheet } from "@/shared/ui/sheet";
import { expenseBadge, fundTotals } from "./expense-categories";
import { Details } from "@/shared/ui/details";
import { Feedback } from "@/shared/ui/feedback";
import { Snackbar } from "@/shared/ui/toast";
import { FadeInView, Notice, Progress, ResourceFeedback, SectionLink, Segments, StatusBadge, ui } from "@/shared/ui/journal";
import { Hint } from "@/shared/ui/hint";
import { Avatar, IconTile } from "./visuals";
import { Screen } from "@/shared/ui/screen";
import { financeCommands } from "./api";
import { ClosureSheet } from "./components/closure-sheet";
import { ClosureChecklist } from "./components/closure-checklist";
import { BankTransfers } from "./components/bank-transfers";
import { MomoPendingGate } from "./components/momo-pending-gate";
import { dateLabel } from "../trips/utils";
import { userNamer } from "../trips/model/member-name";
import { FinanceForm, type FinanceFormSpec } from "./components/finance-form";
import { InstructionSheet } from "./components/instruction-sheet";
import { MomoPaymentSheet } from "./components/momo-payment-sheet";
import { PayosPaymentSheet } from "./components/payos-payment-sheet";
import { PAYOS_ATTEMPT_TITLE, payosReturnPage } from "./payos";
import { createURL } from "expo-linking";
import { getApiBaseUrl } from "@/shared/config/env";
import { DestinationCard } from "./components/destination-card";
import { FundIntro } from "./components/fund-intro";
import { bankDisplayName } from "./bank-names";
import { QUICK_TRANSFER_TITLE } from "@/features/payments/components/quick-transfer";
import { FundPaymentTools } from "@/features/payments/components/fund-payment-tools";
import { PaymentQrEntry } from "@/features/payments/components/payment-qr-entry";
import { paymentSandboxEnabled } from "@/features/payments/sandbox-config";
import { historyTimeLabel as timeAt } from "./history-labels";
import { PagedRecords } from "./components/paged-records";
import { actionLabels, budgetForm, closureActionForm, closureForm, contributionForm, contributionRequestEditForm, contributionRequestForm, destinationForm, enableForm, expenseActionForm, expenseForm, handoverActionForm, handoverCreateForm, momoDestinationForm, refundActionForm, refundForm, refundVerifierForm } from "./forms";
import { contributionActions, expenseActions, financeActor, money, refundActions, refundConfirmer, statusLabels, type RefundContext } from "./model";
import type { Closure, Contribution, Expense, Fund, FinanceCollections, HolderHandover, PaymentAttempt } from "./types";


type Tab = "overview" | "handovers" | "bank-transfers" | Exclude<keyof FinanceCollections, "contributions">;
const tabs: { value: Tab; label: string }[] = [
  { value: "overview", label: "Tài khoản & ngân sách" },
  { value: "contribution-requests", label: "Đợt góp" }, { value: "expenses", label: "Khoản chi" },
  { value: "refunds", label: "Hoàn tiền" }, { value: "bank-transfers", label: "Tiền về" },
  { value: "transactions", label: "Lịch sử" },
  { value: "handovers", label: "Bàn giao" }, { value: "closures", label: "Chốt quỹ" },
];
// Figma D · M14 keeps three everyday tabs; the rest open from the "…" button as their own page.
const mainTabs: { value: Tab; label: string }[] = [
  { value: "expenses", label: "Chi tiêu" }, { value: "contribution-requests", label: "Đóng góp" }, { value: "transactions", label: "Lịch sử" },
];
const moreTabs = { overview: "Tài khoản nhận tiền, công cụ và hướng dẫn", refunds: "Hoàn lại tiền cho thành viên", "bank-transfers": "Giao dịch ngân hàng qua SePay", handovers: "Đổi người giữ quỹ", closures: "Đối chiếu và đóng quỹ" } as const;
const moreIcons = { overview: "wallet", refunds: "swap", "bank-transfers": "file", handovers: "users", closures: "archive" } as const;
const moreTones = { overview: "mint", refunds: "butter", "bank-transfers": "blue", handovers: "lilac", closures: "slate" } as const;
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
  const [mainTab, setMainTab] = useState<Tab>("expenses");
  // Sections from "…" open over the tabs; one can lead to another (closure → refunds).
  const [sections, setSections] = useState<Tab[]>([]);
  const section = sections.at(-1);
  const tab = section ?? mainTab;
  const setTab = useCallback((next: Tab) => {
    const main = mainTabs.some(item => item.value === next);
    if (main) setMainTab(next);
    setSections(current => main ? [] : current.includes(next) ? current.slice(0, current.indexOf(next) + 1) : [...current, next]);
  }, []);
  const closeSection = useCallback(() => setSections(current => current.slice(0, -1)), []);
  const navigation = useNavigation();
  useEffect(() => { navigation.setOptions({ gestureEnabled: !section }); }, [navigation, section]);
  useFocusEffect(useCallback(() => {
    if (!section) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { closeSection(); return true; });
    return () => subscription.remove();
  }, [section, closeSection]));
  const [more, setMore] = useState(false);
  const [form, setForm] = useState<FinanceFormSpec>();
  const [expenseSaved, setExpenseSaved] = useState<{ row?: Expense }>();
  const [instruction, setInstruction] = useState<Contribution>();
  const [momoAttempt, setMomoAttempt] = useState<PaymentAttempt>();
  const [payosAttempt, setPayosAttempt] = useState<PaymentAttempt>();
  const [payosContribution, setPayosContribution] = useState<Contribution>();
  const [momoContribution, setMomoContribution] = useState<Contribution>();
  const [momoError, setMomoError] = useState<string>();
  const [momoLoading, setMomoLoading] = useState(false);
  const [closureId, setClosureId] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const completedKey = useRef<string | undefined>(undefined);
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
  const fundId = fund?.id, financeVersion = fund?.finance_version;
  const totals = useResource(useCallback(async (signal: AbortSignal) => {
    void financeVersion; // Every ledger entry bumps the version; recompute then.
    return fundTotals(await collectPages(cursor => api.finance.list(fundId!, "transactions", cursor, signal), signal));
  }, [api, fundId, financeVersion]), !!fundId);
  const owner = trip?.current_membership.role === "OWNER";
  const archived = trip?.lifecycle === "ARCHIVED";
  const open = (spec: FinanceFormSpec) => { if (!operation.locked && !resource.loading && !resource.error) { setSaved(undefined); setForm(spec); } };
  const locked = operation.locked || resource.loading || !!resource.error || momoLoading;
  const actor = fund ? financeActor(fund, userId, owner, archived) : undefined;
  const canScanPayment = !!actor?.holder && actor.writable && !!trip && !trip.current_membership.left_at && !locked;
  // A QR payment in progress keeps its sheet while its own writes lock the fund.
  const [quickActive, setQuickActive] = useState(false);
  const who = userNamer(members.data, userId);
  const reloadFund = resource.reload, reloadMembers = members.reload;
  const refreshFund = resource.refresh, refreshMembers = members.refresh;
  const reload = useCallback(async () => { await Promise.all([reloadFund(), reloadMembers()]); }, [reloadFund, reloadMembers]);
  useLiveVersion({
    known: fund?.finance_version,
    probe: async signal => (await api.finance.fund(tripId, signal))?.finance_version,
    onChange: () => { void Promise.all([refreshFund(), refreshMembers()]).then(() => setSaved("Quỹ vừa được cập nhật theo thay đổi mới của nhóm.")); },
    enabled: !!fund && !operation.pending && !form && !closureId && !instruction && !operation.locked && !operation.busy && !momoLoading && !resource.loading,
    intervalMs: 5000,
  });
  const completed = operation.pending?.kind === "finance" && operationCommitted(operation.pending) ? operation.pending : undefined;
  const acknowledge = operation.acknowledge, operationBusy = operation.busy;
  useEffect(() => {
    if (!completed || operationBusy || completedKey.current === completed.key) return;
    // The QR payment sheet releases its own writes and shows its own receipt.
    if (completed.title.startsWith(QUICK_TRANSFER_TITLE)) return;
    completedKey.current = completed.key;
    const payment = completed.title === 'Góp quỹ qua MoMo Test' && operation.result && typeof operation.result === 'object' && 'provider' in operation.result && operation.result.provider === 'MOMO_SANDBOX' ? operation.result as PaymentAttempt : undefined;
    const payos = completed.title === PAYOS_ATTEMPT_TITLE && operation.result && typeof operation.result === 'object' && 'provider' in operation.result && operation.result.provider === 'PAYOS' ? operation.result as PaymentAttempt : undefined;
    // Only a known committed result can release the saved request automatically.
    // Pending, rejected and uncertain requests keep their existing recovery UI.
    void (async () => {
      if (await acknowledge()) {
        if (payment) setMomoAttempt(payment);
        if (payos) setPayosAttempt(payos);
        await reload();
        if (completed.title === "Ghi nhận khoản chi" || completed.title === "Sửa khoản chi" || completed.title === "Tạo khoản chi") {
          const row = operation.result;
          setExpenseSaved({ row: row && typeof row === "object" && "created_by_user_id" in row && "amount" in row && "status" in row ? row as Expense : undefined });
        } else setSaved(completed.title === "Nhắc xác nhận chốt quỹ" ? "Đã ghi nhận yêu cầu nhắc xác nhận." : "Đã cập nhật quỹ.");
      }
    })();
  }, [completed, operationBusy, acknowledge, reload, operation.result]);
  async function finish() {
    if (operation.pending?.kind === "leave" && operationCommitted(operation.pending)) router.dismissTo("/(tabs)/trips");
    else await reload();
  }
  async function actOnClosure(row: Closure, action: "confirm" | "cancel" | "remind") {
    if (locked || archived) return;
    if (action === "cancel") {
      setClosureId(undefined);
      open(closureActionForm(row, action));
      return;
    }
    setSaved(undefined);
    const spec = closureActionForm(row, action);
    if (await operation.run({ ...spec.build({}), title: spec.title })) setClosureId(undefined);
  }
  const closureBlockedReason = operation.locked
    ? "Đóng bản chốt để kiểm tra trạng thái yêu cầu trước ở màn quỹ."
    : locked ? "Đóng bản chốt và tải lại quỹ để cập nhật dữ liệu trước khi xác nhận." : undefined;
  const spent = totals.data?.spent;
  const spendLimit = fund?.budget_amount;
  const spendRatio = spent && spendLimit && BigInt(spendLimit) > 0n ? Math.min(100, Math.max(0, Number((BigInt(spent) * 1000n) / BigInt(spendLimit)) / 10)) : 0;
  const visibleMore = (Object.keys(moreTabs) as (keyof typeof moreTabs)[]).filter(value => value !== "bank-transfers" || !!actor?.owner || !!actor?.holder);
  async function payMomo(item: Contribution, retry = false) {
    if (locked || !fund || !actor?.writable) return;
    setMomoError(undefined); setMomoContribution(item);
    if (!retry && item.latest_payment_attempt_id) {
      setMomoLoading(true);
      try {
        const previous = await api.finance.attempt(item.latest_payment_attempt_id);
        if (previous.contribution_id !== item.id || previous.amount !== item.amount) throw Error('Thông tin thanh toán không khớp khoản góp.');
        // A VietQR contribution's latest attempt is a payOS checkout; reopen it in its own sheet.
        if (previous.provider === 'PAYOS' && previous.environment === 'LIVE') { setPayosContribution(item); setPayosAttempt(previous); }
        else if (previous.provider === 'MOMO_SANDBOX' && previous.environment === 'SANDBOX') setMomoAttempt(previous);
        else throw Error('Thông tin thanh toán không khớp khoản góp.');
      } catch { setMomoError('Không tải được lần thanh toán trước. Tải lại quỹ rồi thử lại.'); }
      finally { setMomoLoading(false); }
    } else if (paymentSandboxEnabled) {
      setMomoAttempt(undefined);
      await operation.run(financeCommands.paymentAttempt(fund, item));
    }
  }
  /** Real money via payOS; the server reopens a still-valid link instead of creating another. */
  async function payPayos(item: Contribution) {
    if (locked || !fund || !actor?.writable) return;
    setMomoError(undefined); setInstruction(undefined); setPayosAttempt(undefined); setPayosContribution(item);
    let returnUrl: string;
    try { returnUrl = payosReturnPage(getApiBaseUrl(), createURL("payment-return")); }
    catch { setMomoError("Không tạo được trang quay lại ứng dụng cho payOS."); return; }
    await operation.run(financeCommands.payosAttempt(fund, item, returnUrl));
  }
  return <Screen key={section ?? "fund"} clay title={section ? tabs.find(item => item.value === section)!.label : "Quỹ nhóm"} onBack={section ? closeSection : undefined} tab="trips" onRefresh={() => { void reload(); }} refreshing={resource.loading && !!resource.data}
    headerRight={fund && !section ? <ClayIconButton icon="more" label="Tùy chọn quỹ" onPress={() => setMore(true)} /> : undefined}>
    <OperationFeedback operation={operation} onFinish={finish} finishLabel="Tải lại quỹ" />
    <Snackbar message={saved} />
    {expenseSaved && !form && <DesignPopup kind="expense" message="Quay về quỹ nhóm để theo dõi chi tiêu của chuyến đi."
      onPrimary={() => { setExpenseSaved(undefined); setTab("expenses"); }}
      secondaryLabel={expenseSaved.row && actor && expenseActions(expenseSaved.row, actor).includes("edit") ? "Tiếp tục chỉnh sửa" : "Đóng"}
      onClose={() => { const row = expenseSaved.row; setExpenseSaved(undefined); if (row && actor && fund && trip && expenseActions(row, actor).includes("edit")) open(expenseForm(fund, trip.timezone, who(userId), row)); }} />}
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
    {momoError && <Feedback message={momoError} />}
    {trip && <>
      {fund ? <>
        {!section && <View style={styles.heroCard}>
          <LinearGradient pointerEvents="none" colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 32 }]} />
          <Text style={styles.heroEyebrow}>QUỸ CÒN LẠI</Text>
          <Text selectable style={styles.heroBalance} numberOfLines={1} adjustsFontSizeToFit>{money(fund.current_balance)}</Text>
          {!!spendLimit && BigInt(spendLimit) > 0n && <View style={styles.heroTrack}><View style={[styles.heroFill, { width: `${spendRatio}%` }]} /></View>}
          <Text style={styles.heroText}>{totals.error ? "Chưa tải được tổng thu chi." : spent === undefined ? "Đang tính thu chi…" : `Đã chi ${money(spent)}${spendLimit && BigInt(spendLimit) > 0n ? ` / ${money(spendLimit)}` : ""}`}</Text>
          {totals.error && <Button label="Tải lại tổng thu chi" compact variant="soft" onPress={() => { void totals.reload(); }} />}
          {Number(fund.reserved_refund) > 0 && <Text style={styles.heroText}>Khả dụng: {money(fund.available_balance)} · Giữ chỗ hoàn tiền: {money(fund.reserved_refund)}</Text>}
          <View style={styles.heroTiles}>
            <View style={styles.heroTile}><Text style={styles.heroText}>Đã đóng góp</Text><Text style={styles.heroTileValue} numberOfLines={1} adjustsFontSizeToFit>{totals.data ? money(totals.data.contributed) : "—"}</Text></View>
            <View style={styles.heroTile}><Text style={styles.heroText}>Đã chi tiêu</Text><Text style={styles.heroTileValue} numberOfLines={1} adjustsFontSizeToFit>{spent !== undefined ? money(spent) : "—"}</Text></View>
          </View>
        </View>}
        {(fund.status !== "OPEN" || archived) && <Notice>{fund.status === "CLOSING" ? "Đang chốt quỹ: các giao dịch khác và thay đổi thành viên bị khóa. Mở Chốt quỹ để xem/xác nhận hoặc hủy phiên." : fund.status === "CLOSED" ? "Quỹ đã chốt, không thể góp thêm. Bạn vẫn xem được các đợt góp và lịch sử giao dịch." : "Chuyến đi đã lưu trữ: chỉ xem lịch sử."}</Notice>}
        {fund.status === "CLOSING" && section !== "closures" && <Button label="Mở Chốt quỹ" compact variant="soft" onPress={() => setTab("closures")} />}
        {!section && (actor?.writable || quickActive) && <View style={styles.quickRow}>
          <View style={styles.quickMain}><ClayButton tone="soft" label="Ghi nhận khoản chi" icon={actor?.holder ? undefined : "arrowRightBlue"} disabled={locked} onPress={() => {
          setTab("expenses");
          open(expenseForm(fund, trip.timezone, members.data?.find(member => member.user_id === userId)?.display_name || who(userId)));
          }} /></View>
          {(canScanPayment || quickActive) && <PaymentQrEntry key={fund.id} compact onOpenChange={setQuickActive} record={{ fund, timezone: trip.timezone ?? 'Asia/Ho_Chi_Minh', operation, onRecorded: () => { void reload(); } }} />}
        </View>}
        {!section && <Segments items={mainTabs} value={mainTab} onChange={setTab} />}
        {tab === "overview" ? <FundOverview key={`${fund.id}:${fund.finance_version}`} fund={fund} trip={trip} userId={userId} locked={locked} open={open} who={who} /> : <FundRecords key={`${fund.id}:${fund.finance_version}:${tab}`} fund={fund} trip={trip} userId={userId} tab={tab} members={members.data ?? []} locked={locked} who={who} open={open} onInstruction={setInstruction} onMomo={item => { void payMomo(item); }} onClosure={setClosureId} onTab={setTab} />}
        {((tab === "contribution-requests" || tab === "refunds") && owner) && <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />}
      </> : <>
        <FundIntro budget={trip.budget_amount} members={members.data?.length} canOpen={!!owner && !archived}
          disabled={locked || !members.data || members.loading || !!members.error}
          onOpen={() => open(enableForm(tripId, members.data!, userId, trip.budget_amount))}
          feedback={<ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />} />
      </>}
      {tab === "overview" && paymentSandboxEnabled && canScanPayment && fund && <FundPaymentTools key={`sim-${fund.id}`} fund={fund} timezone={trip?.timezone ?? 'Asia/Ho_Chi_Minh'} />}
      {(!fund || tab === "overview") && <>
      <Details title="Công cụ và hướng dẫn">
      <SectionLink title="Thử thanh toán mô phỏng" subtitle="Góp quỹ, quét QR và xem sổ mẫu miễn phí" icon="wallet" onPress={() => router.push('/demo-trip/fund')} />
      <Hint title="Quỹ hoạt động thế nào?" points={["Tiền vào tài khoản người giữ quỹ; app ghi sổ sau xác nhận.", "Chủ nhóm tạo yêu cầu góp, người giữ quỹ đối chiếu tiền thực tế."]} />
      <SectionLink title="Công cụ quỹ mở rộng" subtitle="Ghi chú, lịch sử và đối soát" icon="wallet" onPress={() => router.push({ pathname: "/trip/[id]/fund-tools", params: { id: tripId } })} />
      </Details>
      </>}
    </>}
    <Sheet visible={more} title="Tùy chọn quỹ" onClose={() => setMore(false)}>
      {visibleMore.map(value => <SettingCard key={value} icon={moreIcons[value]} tone={moreTones[value]} title={tabs.find(item => item.value === value)!.label} subtitle={moreTabs[value]}
        onPress={() => { setMore(false); setTab(value); }} />)}
    </Sheet>
    {form && <FinanceForm spec={form} busy={operation.busy} onSubmit={operation.run} onClose={() => setForm(undefined)} />}
    {instruction && <InstructionSheet contributionId={instruction.id} onClose={() => setInstruction(undefined)}
      onPayos={!locked && actor?.writable && instruction.member_user_id === userId ? () => { void payPayos(instruction); } : undefined} />}
    {payosAttempt && <PayosPaymentSheet key={payosAttempt.id} attempt={payosAttempt} onClose={() => setPayosAttempt(undefined)} onUpdate={reload}
      onRetry={payosContribution && !locked && actor?.writable ? () => { void payPayos(payosContribution); } : undefined} />}
    {momoAttempt && <MomoPaymentSheet key={momoAttempt.id} attempt={momoAttempt} onClose={() => setMomoAttempt(undefined)} onUpdate={reload} onRetry={momoContribution && !locked && actor?.writable ? () => { void payMomo(momoContribution, true); } : undefined} />}
    {closureId && <ClosureSheet closureId={closureId} owner={!!owner} userId={userId} who={who} writable={!archived && !trip?.current_membership.left_at} busy={operation.busy} blockedReason={closureBlockedReason} onClose={() => setClosureId(undefined)} onAction={(row, action) => { void actOnClosure(row, action); }} />}
  </Screen>;
}

type Context = { fund: Fund; trip: Trip; userId: string; locked: boolean; open(spec: FinanceFormSpec): void; who(userId: string): string };
function FundOverview({ fund, trip, userId, locked, open, who }: Context) {
  const api = useApi();
  const actor = financeActor(fund, userId, trip.current_membership.role === "OWNER", trip.lifecycle === "ARCHIVED");
  const destinations = useResource(useCallback((signal: AbortSignal) => api.finance.destinations(fund.id, signal), [api, fund.id]));
  return <FadeInView>
    <Text style={typography.footnote}>Người giữ quỹ: {who(fund.holder_user_id)}</Text>
    {fund.budget_amount !== null && fund.budget_amount !== undefined && <Text style={typography.headline}>Ngân sách dự kiến: {money(fund.budget_amount)}</Text>}
    {actor.owner && actor.writable && <View style={ui.actionRow}>
      <Button label="Cập nhật ngân sách" compact variant="soft" disabled={locked} onPress={() => open(budgetForm(fund))} />
      <Button label="Thêm tài khoản nhận" compact variant="soft" disabled={locked} onPress={() => open(destinationForm(fund))} />
      {paymentSandboxEnabled && <Button label="Thêm MoMo Test" compact variant="soft" disabled={locked} onPress={() => open(momoDestinationForm(fund))} />}
    </View>}
    <Text accessibilityRole="header" style={typography.section}>Tài khoản nhận tiền</Text>
    <ResourceFeedback {...destinations} hasData={!!destinations.data} onRetry={() => { void destinations.reload(); }} />
    <View style={styles.destinations}>
      {destinations.data?.map(row => <DestinationCard key={row.id} row={row}
        canConfirm={actor.writable && !destinations.error && actor.holder && row.active && !row.confirmed_by_holder_at}
        canManage={actor.writable && !destinations.error && actor.owner}
        disabled={locked || destinations.loading}
        onConfirm={() => open({ title: "Xác nhận tài khoản nhận", description: `${row.bank_code ? bankDisplayName(row.bank_code) : "MoMo"} · ${row.account_number ?? row.momo_phone ?? ""} · ${row.account_name ?? ""}. Tôi là người giữ quỹ và đã kiểm tra đúng thông tin. Xác nhận này không phải xác minh của ngân hàng.`, build: () => financeCommands.confirmDestination(fund, row) })}
        onEdit={() => open(destinationForm(fund, row))}
        onToggle={() => open({ title: row.active ? "Tắt tài khoản nhận" : "Bật lại tài khoản nhận", description: "Không sửa tài khoản đã chốt trên các khoản góp cũ. Bật lại sẽ yêu cầu người giữ quỹ xác nhận lại.", build: () => financeCommands.destination(fund, { active: !row.active, is_default: false }, row) })} />)}
      {destinations.data && !destinations.data.length && <Notice>Chưa có tài khoản nhận tiền. {actor.owner ? "Bấm “Thêm tài khoản nhận” ở trên để bắt đầu thu quỹ." : "Chủ nhóm sẽ thêm tài khoản để cả nhóm chuyển khoản."}</Notice>}
    </View>
  </FadeInView>;
}

function FundRecords({ fund, trip, userId, locked, open, who, tab, members, onInstruction, onMomo, onClosure, onTab }: Context & {
  tab: Exclude<Tab, "overview">; members: Membership[]; onInstruction(item: Contribution): void; onMomo(item: Contribution): void; onClosure(id: string): void;
  onTab(tab: Tab): void;
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
  const [expandedExpense, setExpandedExpense] = useState<string>();
  const handoverVersion = useRef(fund.finance_version), reloadHandovers = handovers.reload;
  useEffect(() => {
    if (handoverVersion.current === fund.finance_version) return;
    handoverVersion.current = fund.finance_version;
    void reloadHandovers();
  }, [fund.finance_version, reloadHandovers]);
  const openHandover = handovers.data?.find(row => row.status === "NOMINATED" || row.status === "ACCEPTED");
  const requests = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "contribution-requests", cursor, signal), [api, fund.id]);
  const expenses = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "expenses", cursor, signal), [api, fund.id]);
  const refunds = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "refunds", cursor, signal), [api, fund.id]);
  const transactions = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "transactions", cursor, signal), [api, fund.id]);
  const closures = useCallback((cursor: string | undefined, signal: AbortSignal) => api.finance.list(fund.id, "closures", cursor, signal), [api, fund.id]);
  const destinations = useResource(useCallback((signal: AbortSignal) => api.finance.destinations(fund.id, signal), [api, fund.id]), actor.owner && actor.writable && tab === "contribution-requests");
  const status = (value: string) => <StatusBadge status={value} label={statusLabels[value]} />;
  const contribute = actor.owner && actor.writable && <>
    <ResourceFeedback {...destinations} hasData={!!destinations.data} onRetry={() => { void destinations.reload(); }} />
    <Button label="Tạo đợt góp" disabled={locked || !members.length || !destinations.data || destinations.loading || !!destinations.error} onPress={() => {
      const eligible = destinations.data?.filter(row => paymentSandboxEnabled || row.destination_type === "VIETQR");
      if (eligible) open(contributionRequestForm(fund, members, eligible, userId, trip.timezone));
    }} />
  </>;
  return <View style={ui.stack}>
    {tab === "contribution-requests" && <>{contribute}<PagedRecords version={fund.finance_version} title="đợt góp" load={requests} render={row => <>
      <View style={ui.recordHeader}>
        <Text style={typography.headline}>{row.title}</Text>
        {(row.status !== "OPEN" || actor.writable) && status(row.status)}
      </View>
      {row.note && <Text style={typography.body}>{row.note}</Text>}
      <Text style={typography.footnote}>{row.due_at ? `Hạn: ${timeAt(row.due_at, trip.timezone)}` : "Không đặt hạn"}</Text>
      {!!row.contributions?.length && <>
        <View style={ui.recordHeader}>
          <Text style={typography.footnote}>Đã góp {row.contributions.filter(item => item.status === "CONFIRMED").length}/{row.contributions.length} người</Text>
        </View>
        <Progress done={row.contributions.filter(item => item.status === "CONFIRMED").length} total={row.contributions.length} />
      </>}
      {row.contributions?.map(item => {
        const allocationActor = { ...actor, writable: actor.writable && row.status === "OPEN" };
        return <View key={item.id} style={ui.card}>
          <View style={ui.recordHeader}>
            <Text style={typography.headline}>{money(item.amount)}</Text>
            {status(item.status)}
          </View>
          <View style={ui.row}>
            <Avatar name={who(item.member_user_id)} />
            <Text style={[typography.body, ui.flex]}>{item.member_user_id === userId ? "Khoản đóng của bạn" : who(item.member_user_id)}</Text>
          </View>
          {item.waived_reason && <Text style={typography.body}>Lý do miễn: {item.waived_reason}</Text>}
          {item.cancelled_reason && <Text style={typography.body}>Lý do hủy: {item.cancelled_reason}</Text>}
          {item.rejected_reason && <Text style={typography.body}>Lý do từ chối gần nhất: {item.rejected_reason}</Text>}
          <View style={ui.actionRow}>
            <MomoPendingGate item={item} locked={locked} onOpen={onMomo}>
              {allocationActor.writable && item.member_user_id === userId && item.status === "PENDING" && (item.destination_type === 'MOMO_SANDBOX'
                ? paymentSandboxEnabled && <Button label="Góp bằng MoMo Test" compact variant="soft" disabled={locked} onPress={() => onMomo(item)} />
                : <Button label="Xem QR góp quỹ" compact variant="soft" disabled={locked} onPress={() => onInstruction(item)} />)}
              {contributionActions(item, allocationActor).map(action => <Button key={action} label={actionLabels[action]} compact accessibilityLabel={`${actionLabels[action]} · ${who(item.member_user_id)} · ${money(item.amount)}`} variant="soft" disabled={locked} onPress={() => open(contributionForm(fund, item, action, who))} />)}
            </MomoPendingGate>
          </View>
        </View>;
      })}
      {actor.owner && actor.writable && row.status === "OPEN" && <View style={ui.actionRow}><Button label="Sửa đợt đóng góp" compact accessibilityLabel={`Sửa đợt đóng góp ${row.title}`} variant="soft" disabled={locked} onPress={() => open(contributionRequestEditForm(fund, row, trip.timezone))} /></View>}
    </>} /></>}
    {tab === "expenses" && <>
      <PagedRecords plain version={fund.finance_version} title="khoản chi" load={expenses} render={row => {
        const badge = expenseBadge(row.category, row.title), actions = expenseActions(row, actor);
        const recorded = row.status === "CONFIRMED";
        const canExpand = recorded && !!(actions.length || row.description || row.receipt_available || row.category);
        const showDetails = !recorded || expandedExpense === row.id;
        const recorder = members.find(member => member.user_id === row.created_by_user_id)?.display_name || who(row.created_by_user_id);
        const summary = <>
            <CardIcon icon={badge.icon} tone={badge.tone} />
            <View style={styles.expenseCopy}>
              <Text style={styles.expenseTitle} numberOfLines={2}>{row.title}</Text>
              <Text style={claySubtitle} numberOfLines={2}>{dateLabel(row.paid_at ?? row.created_at, trip.timezone).slice(0, 5)} · {recorder}</Text>
            </View>
            <Text style={[styles.expenseAmount, !recorded && { color: claySubtitle.color }, row.status === "REVERSED" && { textDecorationLine: "line-through" }]} numberOfLines={1} adjustsFontSizeToFit>{recorded ? "−" : ""}{money(row.amount)}</Text>
        </>;
        return <View style={styles.expense}>
          {canExpand ? <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={`Chi tiết khoản chi ${row.title}`}
            accessibilityState={{ expanded: showDetails }} onPress={() => setExpandedExpense(showDetails ? undefined : row.id)}
            style={({ pressed }) => [styles.expenseRow, pressed && { opacity: 0.75 }]}>{summary}</Pressable> : <View style={styles.expenseRow}>{summary}</View>}
          {showDetails && <>
          {!recorded && status(row.status)}
          {!!row.category && <Text style={claySubtitle}>{row.category}</Text>}
          {!!row.description && <Text style={typography.body}>{row.description}</Text>}
          {!!row.rejected_reason && <Text style={typography.body}>Lý do từ chối: {row.rejected_reason}</Text>}
          {row.receipt_available && <ExpenseReceipt expenseId={row.id} />}
          {!!actions.length && <View style={ui.actionRow}>
            {actions.map(action => <Button key={action} label={actionLabels[action]} compact accessibilityLabel={`${actionLabels[action]} ${row.title}`} variant="soft" disabled={locked} onPress={() => open(action === "edit" ? expenseForm(fund, trip.timezone, recorder, row) : expenseActionForm(fund, row, action, trip.timezone))} />)}
          </View>}
          </>}
        </View>;
      }} />
    </>}
    {tab === "refunds" && <>
      {actor.owner && actor.writable && <Button label="Tạo hoàn tiền" disabled={locked || !members.length} onPress={() => open(refundForm(fund, members, userId))} />}
      <PagedRecords version={fund.finance_version} title="hoàn tiền" load={refunds} render={row => <>
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
    {tab === "transactions" && <PagedRecords version={fund.finance_version} title="giao dịch" load={transactions} render={row => <>
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
    {tab === "bank-transfers" && (actor.owner || actor.holder) && <BankTransfers fund={fund} timezone={trip.timezone} holder={actor.holder} writable={actor.writable && !trip.current_membership.left_at} locked={locked} open={open} who={who} />}
    {tab === "closures" && <>
      {actor.writable && <ClosureChecklist
        fund={fund}
        canRequest={actor.owner}
        locked={locked}
        onRequest={() => open(closureForm(fund))}
        onOpen={target => target === "fund-tools"
          ? router.push({ pathname: "/trip/[id]/fund-tools", params: { id: trip.id } })
          : onTab(target)} />}
      <PagedRecords version={fund.finance_version} title="phiên chốt quỹ" load={closures} render={row => <>
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
  destinations: { gap: 14 },
  quickRow: { flexDirection: "row", gap: 10 },
  quickMain: { flex: 1, minWidth: 0 },
  heroCard: { gap: 6, padding: 20, borderRadius: 32, marginTop: -6, ...shadows.card },
  heroEyebrow: { fontFamily: fonts.heading, fontSize: 11, lineHeight: 14, letterSpacing: 0.88, color: colors.surface, opacity: 0.85 },
  heroBalance: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 42, color: colors.surface },
  heroTrack: { height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.3)" },
  heroFill: { height: 8, borderRadius: 4, backgroundColor: colors.surface },
  heroText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: colors.surface },
  heroTiles: { flexDirection: "row", gap: 10, paddingTop: 6 },
  heroTile: { flex: 1, minWidth: 0, gap: 2, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)" },
  heroTileValue: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22, color: colors.surface },
  expense: { gap: 10, paddingVertical: 12, paddingLeft: 12, paddingRight: 14, borderRadius: 22, backgroundColor: colors.surface, ...shadows.glass },
  expenseRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  expenseCopy: { flex: 1, minWidth: 0, gap: 1 },
  expenseTitle: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 22, color: colors.ink },
  expenseAmount: { maxWidth: "50%", fontFamily: fonts.heading, fontSize: 15, lineHeight: 22, color: "#FF6F59" },
  receiptImage: {
    width: "100%",
    height: 260,
    borderRadius: radii.control,
    backgroundColor: colors.fill,
  },
});
