import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { createURL } from "expo-linking";
import { AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { financeCommands } from "@/features/finance/api";
import { bankDisplayName } from "@/features/finance/bank-names";
import { EXPENSE_CATEGORIES } from "@/features/finance/expense-categories";
import { money } from "@/features/finance/model";
import type { Expense, Fund } from "@/features/finance/types";
import { resolveVietQrBank } from "@/features/finance/vietqr-banks";
import { errorMessage } from "@/shared/api/errors";
import { useApi } from "@/shared/api/use-api";
import { getApiBaseUrl } from "@/shared/config/env";
import { randomUUID } from "@/shared/operations/operation-id";
import { operationCommitted, operationTerminal } from "@/shared/operations/controller";
import type { useTripOperation } from "@/shared/operations/use-trip-operation";
import { colors, fonts, gradients, shadows } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { Notice } from "@/shared/ui/journal";
import { toast } from "@/shared/ui/toast";
import { paymentReturnPage, type SandboxWallet } from "../api";
import { openPaymentApp } from "../open-payment-app";
import { paymentSandboxEnabled } from "../sandbox-config";
import { vietQrPayload, type PaymentQr } from "../model/payment-qr";
import { InviteQr } from "@/features/trips/components/invite-qr";
import { SandboxBankApp, type SandboxBankResult } from "./sandbox-bank-app";
import { paymentTransfer, scannedBankDeeplink, type PaymentTransfer } from "../model/payment-transfer";
import { amountLabel, BANK_APPS, bankApp, initials, pressKey, quickExpense, shortBankName, type BankApp, type KeypadKey } from "../model/quick-transfer";

type Operation = ReturnType<typeof useTripOperation>;
export type QuickTransferRecord = { fund: Fund; timezone: string; operation: Operation; onRecorded(): void };
type Step = "check" | "source" | "receipt";
const LAST_APP = "wolfari.quick-transfer.app.v1";
/** Only with EXPO_PUBLIC_PAYMENT_SANDBOX=true: a bank screen inside Wolfari for testing the flow. */
const TEST_BANK: BankApp = { id: "sandbox", name: "Ngân hàng thử · Sandbox", autofill: true };
/** Only in sandbox builds: a MoMo test-gateway order (ATM test card, card, or MoMo test app). */
const MOMO: BankApp = { id: "momo", name: "MoMo · Sandbox", autofill: true };
const SANDBOX_APPS = [TEST_BANK, MOMO];
const walletOf = (app?: BankApp): SandboxWallet | undefined => app?.id === MOMO.id ? "momo" : undefined;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** Prefix of this sheet's operation titles; the fund screen leaves those to the sheet. */
export const QUICK_TRANSFER_TITLE = "Chi qua QR";
const KEYS: KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"];

/**
 * Scan a VietQR, check the amount, open the bank app with it filled in, and keep the payment as an
 * expense of the trip fund (video reference from the team: "Kiểm tra khoản chi").
 * The expense is a draft until the holder says the bank transfer went through; only then is it
 * submitted and confirmed, which takes it out of the fund balance.
 */
export function QuickTransfer({ payment, record, onScanAgain, onClose, onEditRecipient }: {
  payment: PaymentQr; record: QuickTransferRecord; onScanAgain(): void; onClose(): void;
  /** Typed recipients can be corrected before anything is saved. */
  onEditRecipient?(): void;
}) {
  const { fund, operation } = record;
  const fixedAmount = !!payment.amount;
  const [step, setStep] = useState<Step>("check");
  const [amount, setAmount] = useState(payment.amount ?? "");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState(payment.note ?? payment.reference ?? "");
  const [app, setApp] = useState<BankApp>();
  const [transfer, setTransfer] = useState<PaymentTransfer>();
  const [expense, setExpense] = useState<Expense>();
  const [status, setStatus] = useState<"draft" | "confirmed" | "deleted">("draft");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [backFromBank, setBackFromBank] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [walletState, setWalletState] = useState<"checking" | "pending" | "failed">();
  const walletOrder = useRef<{ id: string; url: string; wallet: SandboxWallet }>(undefined);
  const walletCheck = useRef<() => void>(undefined);
  const checking = useRef(false);
  const api = useApi();
  const [bankReference, setBankReference] = useState<string>();
  const [showQr, setShowQr] = useState(false);
  const qrPayload = (() => {
    const receiving = resolveVietQrBank(payment.bankBin);
    if (!transfer || !receiving) return undefined;
    try { return vietQrPayload({ bankBin: receiving.bin, account: transfer.account, amount: transfer.amount, note: transfer.note }); }
    catch { return undefined; }
  })();
  const apps = paymentSandboxEnabled ? [...SANDBOX_APPS, ...BANK_APPS] : BANK_APPS;
  const opened = useRef(false);
  const bank = resolveVietQrBank(payment.bankBin);
  const bankLabel = shortBankName(bankDisplayName(payment.bankBin));

  useEffect(() => {
    void AsyncStorage.getItem(LAST_APP).then(id => {
      const saved = (paymentSandboxEnabled ? SANDBOX_APPS.find(item => item.id === id) : undefined) ?? bankApp(id);
      if (saved) setApp(current => current ?? saved);
    }).catch(() => undefined);
  }, []);
  // Coming back from the bank app is the moment to ask whether the money left.
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => {
      if (state !== "active" || !opened.current) return;
      setBackFromBank(true);
      walletCheck.current?.();
    });
    return () => listener.remove();
  }, []);
  useEffect(() => { walletCheck.current = () => { void checkWallet(); }; });

  /** One server write through the trip operation; returns the expense it answered with. */
  async function write(command: Parameters<Operation["run"]>[0]): Promise<Expense | undefined> {
    if (!await operation.run({ ...command, title: `${QUICK_TRANSFER_TITLE} · ${command.title}` })) return undefined;
    const snapshot = operation.getSnapshot();
    if (!operationCommitted(snapshot.pending)) {
      // A refused write (for example not enough money in the fund) is final: release it so the
      // fund is not left locked, and say why here.
      if (operationTerminal(snapshot.pending)) {
        const reason = snapshot.error;
        await operation.acknowledge();
        throw new Error(reason ?? "Máy chủ không nhận thao tác này.");
      }
      return undefined;
    }
    const row = snapshot.result as Expense | undefined;
    await operation.acknowledge();
    if (row && typeof row === "object" && "id" in row && "version" in row) return row;
    // Committed but answered without the row (a recovered request): the expense list has it.
    record.onRecorded();
    throw new Error("Đã ghi khoản chi trên máy chủ. Mở tab Chi tiêu để tiếp tục với khoản này.");
  }

  function toSource() {
    try {
      setTransfer(paymentTransfer(payment, amount, note.trim() || `Chuyển khoản ${bankLabel}`));
      setMessage(undefined);
      setStep("source");
    } catch (cause) { setMessage(errorMessage(cause)); }
  }

  async function openBank(target = app, current = transfer) {
    if (!target || !current) return;
    // Sandbox: a stand-in bank app takes over the screen, so the flow runs without a bank app or money.
    if (target.id === TEST_BANK.id) { setBankOpen(true); return; }
    const wallet = walletOf(target);
    if (wallet) { await openWallet(current, wallet); return; }
    if (!target.autofill) await Clipboard.setStringAsync(current.note).catch(() => undefined);
    opened.current = true;
    await openPaymentApp(scannedBankDeeplink(current, target.id));
  }

  async function recordAndOpen() {
    if (busy || !transfer || !app) return;
    if (operation.locked) { setMessage("Quỹ đang có một yêu cầu chưa xong ở đầu màn hình. Xử lý xong rồi thử lại."); return; }
    setBusy(true); setMessage(undefined);
    try {
      void AsyncStorage.setItem(LAST_APP, app.id).catch(() => undefined);
      let row: Expense | undefined;
      try { row = await write(financeCommands.expense(fund, quickExpense(transfer, category, app, new Date().toISOString()))); }
      catch (cause) { setMessage(errorMessage(cause)); return; }
      if (!row) { setMessage(operation.getSnapshot().error ?? "Chưa ghi được khoản chi. Kiểm tra trạng thái ở đầu màn Quỹ nhóm."); return; }
      setExpense(row); setStatus("draft"); setStep("receipt");
      try { await openBank(); }
      catch (cause) {
        setMessage(walletOf(app) ? `Chưa tạo được đơn ${shortBankName(app.name)} Sandbox: ${errorMessage(cause)}`
          : `Không mở được ${shortBankName(app.name)}. Kiểm tra app đã cài, hoặc chuyển thủ công theo thông tin trên.`);
      }
    } finally { setBusy(false); }
  }

  /** The bank says done: submit and confirm, which takes the amount out of the fund. */
  async function confirmPaid(paidAt = new Date().toISOString()) {
    if (busy || !expense) return;
    setBusy(true); setMessage(undefined);
    try { await confirmSteps(expense, paidAt); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  /** Creates (or reuses) the MoMo test order and opens its payment page. */
  async function openWallet(current: PaymentTransfer, wallet: SandboxWallet, fresh = false) {
    let order = fresh || walletOrder.current?.wallet !== wallet ? undefined : walletOrder.current;
    if (!order) {
      const row = await api.payments.walletCheckout(wallet, fund.trip_id, {
        request_id: randomUUID(), amount: current.amount, note: current.note,
        redirect_url: paymentReturnPage(getApiBaseUrl(), createURL("payment-return")),
      });
      order = { id: row.order_id, url: row.payment_url, wallet };
      walletOrder.current = order;
    }
    setWalletState(undefined);
    opened.current = true;
    await openPaymentApp(order.url);
  }
  /** Asks MoMo (through Finance) for the result; PAID records the expense with no extra tap. */
  async function checkWallet(attempts = 4) {
    const order = walletOrder.current;
    if (!order || checking.current || status !== "draft") return;
    checking.current = true; setWalletState("checking"); setMessage(undefined);
    try {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const row = await api.payments.walletStatus(order.wallet, fund.trip_id, order.id);
        if (row.status === "PAID") {
          setWalletState(undefined); setBackFromBank(false); setBankReference(row.provider_transaction_id ?? order.id);
          await confirmPaid();
          return;
        }
        if (row.status === "FAILED") { setWalletState("failed"); return; }
        if (attempt < attempts - 1) await wait(2000);
      }
      setWalletState("pending");
    } catch (cause) { setWalletState("pending"); setMessage(errorMessage(cause)); }
    finally { checking.current = false; }
  }
  /** The sandbox bank reports its result itself: a success records the expense with no extra tap. */
  function sandboxFinished(result: SandboxBankResult) {
    setBankOpen(false);
    if (result.status === "success") { setBankReference(result.reference); void confirmPaid(result.paidAt); }
    else setBackFromBank(true);
  }
  async function confirmSteps(expense: Expense, paidAt: string) {
    {
      const submitted = expense.status === "DRAFT"
        ? await write(financeCommands.expenseAction({ ...fund, finance_version: expense.finance_version }, expense, "submit"))
        : expense;
      if (!submitted) { setMessage(operation.getSnapshot().error ?? "Chưa gửi được khoản chi."); return; }
      setExpense(submitted);
      const confirmed = await write(financeCommands.expenseAction({ ...fund, finance_version: submitted.finance_version }, submitted, "confirm",
        { paid_at: paidAt, payment_method: "BANK_TRANSFER" }));
      if (!confirmed) { setMessage(operation.getSnapshot().error ?? "Khoản chi đã gửi nhưng chưa xác nhận được. Mở tab Chi tiêu để xác nhận."); return; }
      setExpense(confirmed); setStatus("confirmed"); setBackFromBank(false);
      toast.success(`Đã ghi chi ${money(confirmed.amount)} từ quỹ.`, { title: "Đã ghi khoản chi" });
      record.onRecorded();
    }
  }

  async function remove() {
    if (busy || !expense) return;
    setBusy(true); setMessage(undefined);
    try {
      // A submitted expense goes back to draft first; only drafts can be deleted.
      let draft = expense;
      if (expense.status === "SUBMITTED") {
        try { draft = await write(financeCommands.expenseAction({ ...fund, finance_version: expense.finance_version }, expense, "withdraw")) ?? expense; }
        catch (cause) { setMessage(errorMessage(cause)); return; }
        setExpense(draft);
        if (draft.status !== "DRAFT") { setMessage(operation.getSnapshot().error ?? "Chưa rút được khoản chi về nháp."); return; }
      }
      const removal = financeCommands.expenseAction({ ...fund, finance_version: draft.finance_version }, draft, "delete");
      if (!await operation.run({ ...removal, title: `${QUICK_TRANSFER_TITLE} · Xoá khoản chi` }) || !operationCommitted(operation.getSnapshot().pending)) {
        setMessage(operation.getSnapshot().error ?? "Chưa xoá được khoản chi."); return;
      }
      await operation.acknowledge();
      setStatus("deleted"); setBackFromBank(false);
      record.onRecorded();
    } finally { setBusy(false); }
  }

  const recipientCard = <View style={styles.recipient}>
    <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
      <Text style={styles.avatarText}>{initials(payment.recipientLabel || bankLabel)}</Text>
    </LinearGradient>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.name} numberOfLines={1}>{payment.recipientLabel || "QR không có tên người nhận"}</Text>
      <Text selectable style={styles.sub}>{bankLabel} · {payment.account}</Text>
    </View>
  </View>;

  if (step === "receipt" && expense && transfer && app) {
    const time = new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: record.timezone }).format(new Date(expense.created_at));
    const sandbox = app.id === TEST_BANK.id;
    const wallet = walletOf(app), viaWallet = !!wallet, walletName = shortBankName(app.name);
    return <View style={styles.stack}>
      {sandbox && bankOpen && <SandboxBankApp transfer={transfer} bankLabel={bankLabel} onFinish={sandboxFinished} />}
      <View style={styles.receiptHead}>
        <Text style={styles.sub}>{time}</Text>
        <Text style={[styles.receiptAmount, status === "deleted" && { textDecorationLine: "line-through", color: colors.muted }]}>−{amountLabel(transfer.amount)}</Text>
        <Text style={styles.name}>{transfer.recipientLabel || bankLabel}</Text>
        <View style={[styles.badge, status === "confirmed" ? styles.badgeOk : status === "deleted" ? styles.badgeOff : styles.badgeWait]}>
          <Text style={styles.badgeText}>{status === "confirmed" ? "Đã ghi chi · trừ vào quỹ" : status === "deleted" ? "Đã xoá" : expense.status === "SUBMITTED" ? "Đã gửi duyệt · chưa trừ quỹ" : "Chờ bạn xác nhận đã chuyển"}</Text>
        </View>
      </View>
      <View style={styles.rows}>
        <Row label="Tài khoản nhận" value={`${transfer.account} · ${bankLabel}`} />
        <Row label="Danh mục" value={category || "Khác"} />
        <Row label="Nguồn chi" value={shortBankName(app.name)} />
        {bankReference && <Row label="Mã giao dịch" value={bankReference} />}
        <Row label="Ghi chú" value={transfer.note} last />
      </View>
      {status === "draft" && <>
        {bankReference && busy && <Notice>{shortBankName(app.name)} báo giao dịch thành công. Đang ghi khoản chi…</Notice>}
        {viaWallet && walletState === "checking" && <Notice>Đang hỏi {walletName} kết quả thanh toán…</Notice>}
        {viaWallet && walletState === "pending" && <Notice>{walletName} chưa báo thanh toán xong. Nếu bạn đã trả, đợi vài giây rồi bấm Kiểm tra lại.</Notice>}
        {viaWallet && walletState === "failed" && <Notice>{walletName} báo giao dịch chưa thành công. Khoản chi vẫn là nháp; bạn có thể thanh toán lại.</Notice>}
        {backFromBank && !viaWallet && <Notice>Bạn vừa quay lại từ {shortBankName(app.name)}. Giao dịch đã thành công chưa?</Notice>}
        {!app.autofill && <Text style={styles.hint}>{shortBankName(app.name)} không tự điền: Wolfari đã sao chép nội dung chuyển khoản, bạn dán vào ô nội dung.</Text>}
        {BigInt(transfer.amount) > BigInt(fund.available_balance) && <Notice>Quỹ khả dụng còn {money(fund.available_balance)}, chưa đủ {money(transfer.amount)}. Khoản chi sẽ được gửi duyệt và chỉ trừ quỹ khi có thêm tiền vào quỹ.</Notice>}
        {viaWallet && expense.status !== "SUBMITTED"
          ? <Button label={`Kiểm tra thanh toán ${walletName}`} loading={busy || walletState === "checking"} onPress={() => { void checkWallet(1); }} />
          : <Button label={expense.status === "SUBMITTED" ? "Xác nhận lại · trừ quỹ" : "Đã chuyển xong · ghi chi"} loading={busy} onPress={() => { void confirmPaid(); }} />}
        <Button label={viaWallet && walletState === "failed" ? `Thanh toán lại với ${walletName}` : `Mở lại ${walletName}`} variant="soft" disabled={busy}
          onPress={() => {
            const retry = viaWallet && walletState === "failed";
            void (retry && transfer && wallet ? openWallet(transfer, wallet, true) : openBank()).catch(cause => setMessage(`Không mở được ${shortBankName(app.name)}: ${errorMessage(cause)}`));
          }} />
        {!sandbox && !viaWallet && <View style={styles.help}>
          <Text style={styles.label}>App ngân hàng bắt đăng nhập rồi không hiện màn chuyển khoản?</Text>
          <Text style={styles.hint}>Nhiều app ngân hàng bỏ thông tin điền sẵn khi phải đăng nhập lại; Wolfari không điều khiển được bước đó.</Text>
          <Text style={styles.hint}>1. Đăng nhập xong, giữ nguyên app ngân hàng và quay lại đây.</Text>
          <Text style={styles.hint}>2. Bấm “Mở lại {shortBankName(app.name)}”: app đã đăng nhập thường mở thẳng màn chuyển khoản điền sẵn.</Text>
          <Text style={styles.hint}>3. Chắc chắn nhất: chụp màn hình mã QR dưới đây, rồi trong app ngân hàng chọn Quét QR → chọn ảnh. Mọi ngân hàng (cả MoMo, ZaloPay) đều điền đủ người nhận, số tiền và nội dung.</Text>
          {qrPayload && (showQr
            ? <View style={{ gap: 6, alignItems: "center" }}>
              <InviteQr value={qrPayload} size={220} label={`Mã VietQR chuyển ${amountLabel(transfer.amount)} đến ${transfer.account}`} />
              <Text style={styles.sub}>{amountLabel(transfer.amount)} · {transfer.account} · {bankLabel}</Text>
            </View>
            : <Button label="Hiện mã QR để quét bằng app ngân hàng" variant="soft" compact onPress={() => setShowQr(true)} />)}
          <Button label="Sao chép thông tin chuyển khoản" variant="soft" compact disabled={busy} onPress={() => {
            void Clipboard.setStringAsync(transferText(transfer, bankLabel))
              .then(() => toast.success("Đã sao chép số tài khoản, số tiền và nội dung.", { title: "Đã sao chép" }))
              .catch(() => setMessage("Không sao chép được. Nhấn giữ từng dòng ở trên để sao chép."));
          }} />
        </View>}
        <Button label="Chưa chuyển · xoá khoản này" variant="text" disabled={busy} onPress={() => { void remove(); }} />
      </>}
      {status !== "draft" && <>
        <Button label="Chuyển khoản mới" onPress={onScanAgain} />
        <Button label="Xong" variant="soft" onPress={onClose} />
      </>}
      {message && <Feedback inline message={message} />}
    </View>;
  }

  if (step === "source" && transfer) {
    return <View style={styles.stack}>
      {recipientCard}
      <Text style={styles.big}>{amountLabel(transfer.amount)}</Text>
      {BigInt(transfer.amount) > BigInt(fund.available_balance) && <Notice>Số tiền lớn hơn quỹ khả dụng ({money(fund.available_balance)}). Vẫn chuyển được, nhưng sau khi ghi chi quỹ sẽ cần bù phần thiếu.</Notice>}
      <Text style={styles.label}>Chuyển bằng app nào?</Text>
      {!bank && <Notice>Ngân hàng nhận chưa có trong danh mục VietQR. App ngân hàng sẽ mở nhưng không điền sẵn được.</Notice>}
      <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled contentContainerStyle={{ gap: 8 }}>
        {apps.map(item => {
          const selected = app?.id === item.id;
          return <Pressable key={item.id} cssInterop={false} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected}
            accessibilityLabel={shortBankName(item.name)} onPress={() => setApp(item)}
            style={({ pressed }) => [styles.app, selected && styles.appOn, pressed && { opacity: 0.85 }]}>
            <BankLogo app={item} />
            <Text style={styles.appName} numberOfLines={1}>{shortBankName(item.name)}</Text>
            {selected && <View style={styles.radioOn}><DesignIcon name="check" size={13} tintColor={colors.surface} /></View>}
          </Pressable>;
        })}
      </ScrollView>
      {app && <View style={styles.confirm}>
        <Text style={styles.name}>Mở {shortBankName(app.name)}</Text>
        <Text style={styles.sub}>{app.autofill ? `${shortBankName(app.name)} sẽ điền sẵn người nhận, số tiền và nội dung. Bạn chỉ cần xác nhận.` : `Wolfari sao chép nội dung "${transfer.note}" để bạn dán trong ${shortBankName(app.name)}.`}</Text>
        <Text style={styles.sub}>{app.id === TEST_BANK.id ? "Ngân hàng thử mở toàn màn hình như một app riêng. Giao dịch thành công thì Wolfari tự ghi khoản chi."
          : app.id === MOMO.id ? "Mở cổng thanh toán thử của MoMo (thẻ ATM thử, thẻ tín dụng thử hoặc app MoMo thử, không tốn tiền thật). Trả xong MoMo đưa bạn về Wolfari và khoản chi được ghi khi MoMo xác nhận."
          : "Khoản chi được lưu nháp ngay; quỹ chỉ bị trừ khi bạn báo đã chuyển xong."}</Text>
        {!SANDBOX_APPS.some(item => item.id === app.id) && <Text style={styles.sub}>Mẹo: mở {shortBankName(app.name)} và đăng nhập sẵn trước. App ngân hàng vừa đăng nhập lại thường bỏ thông tin điền sẵn.</Text>}
      </View>}
      {message && <Feedback inline message={message} />}
      <Button label={app ? `Mở ${shortBankName(app.name)} để chuyển` : "Chọn app để chuyển"} disabled={!app} loading={busy} onPress={() => { void recordAndOpen(); }} />
      <Button label="Sửa số tiền, danh mục" variant="text" disabled={busy} onPress={() => { setStep("check"); setMessage(undefined); }} />
    </View>;
  }

  return <View style={styles.stack}>
    {recipientCard}
    <View style={styles.amountBox}>
      <Text style={[styles.big, !amount && { color: colors.muted }]} accessibilityLiveRegion="polite">{amountLabel(amount)}</Text>
      {fixedAmount && <Text style={styles.sub}>Số tiền theo mã QR</Text>}
      <Text style={styles.sub}>Quỹ khả dụng: {money(fund.available_balance)}</Text>
    </View>
    <Text style={styles.label}>Danh mục</Text>
    <View style={styles.chips}>
      {EXPENSE_CATEGORIES.map(name => <Pressable key={name} cssInterop={false} accessibilityRole="radio" accessibilityState={{ checked: category === name }}
        aria-checked={category === name} onPress={() => setCategory(name)} style={[styles.chip, category === name && styles.chipOn]}>
        <Text style={[styles.chipText, category === name && { color: colors.surface }]}>{name}</Text>
      </Pressable>)}
    </View>
    <Text style={styles.label}>Ghi chú</Text>
    <TextInput value={note} onChangeText={setNote} maxLength={150} placeholder="Ví dụ: Cà phê sáng cả nhóm" placeholderTextColor={colors.muted}
      accessibilityLabel="Ghi chú" style={styles.note} />
    {!fixedAmount && <View style={styles.keypad} accessibilityLabel="Bàn phím số tiền">
      {KEYS.map(key => <Pressable key={key} cssInterop={false} accessibilityRole="button" accessibilityLabel={key === "back" ? "Xoá một số" : key}
        onPress={() => { setAmount(value => pressKey(value, key)); setMessage(undefined); }}
        style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.fill }]}>
        {key === "back" ? <Text style={styles.keyText}>⌫</Text> : <Text style={styles.keyText}>{key}</Text>}
      </Pressable>)}
    </View>}
    {message && <Feedback inline message={message} />}
    <Button label="Chuyển khoản" disabled={!amount} onPress={toSource} />
    {onEditRecipient ? <Button label="Sửa thông tin người nhận" variant="text" onPress={onEditRecipient} />
      : <Button label="Quét mã khác" variant="text" onPress={onScanAgain} />}
  </View>;
}

function BankLogo({ app }: { app: BankApp }) {
  const sources = [app.logo, app.fallbackLogo].filter((uri): uri is string => !!uri);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const uri = sources[index];
  return <LinearGradient colors={app.id === MOMO.id ? ["#A50064", "#D82D8B"] : gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.appLogo}>
    <Text style={styles.appLogoText}>{app.id === TEST_BANK.id ? "W" : app.id === MOMO.id ? "MoMo" : app.id.slice(0, 3).toUpperCase()}</Text>
    {uri ? <Image key={uri} source={{ uri }} style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0, backgroundColor: colors.surface }]} contentFit={index === 0 ? "cover" : "contain"}
      onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setIndex(value => value + 1); }} accessible={false} /> : null}
  </LinearGradient>;
}

/** Plain lines for a manual transfer when the bank app dropped the filled-in details. */
function transferText(transfer: PaymentTransfer, bankLabel: string) {
  return [
    `Ngân hàng: ${bankLabel}`,
    `Số tài khoản: ${transfer.account}`,
    ...(transfer.recipientLabel ? [`Người nhận: ${transfer.recipientLabel}`] : []),
    `Số tiền: ${transfer.amount}`,
    `Nội dung: ${transfer.note}`,
  ].join("\n");
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text selectable style={styles.rowValue} numberOfLines={2}>{value}</Text>
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  recipient: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 22, backgroundColor: colors.surface, ...shadows.glass },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.heading, fontSize: 16, color: colors.surface },
  name: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 21, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  amountBox: { alignItems: "center", gap: 2, paddingVertical: 6 },
  big: { fontFamily: fonts.heading, fontSize: 38, lineHeight: 46, color: colors.ink, textAlign: "center" },
  label: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 19, color: colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999, backgroundColor: colors.fill },
  chipOn: { backgroundColor: colors.blue },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  note: { minHeight: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  keypad: { flexDirection: "row", flexWrap: "wrap", rowGap: 6 },
  key: { width: "33.33%", height: 54, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  keyText: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink },
  app: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 54, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  appOn: { borderColor: colors.blue, backgroundColor: colors.tealSoft },
  appLogo: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  appLogoText: { fontFamily: fonts.heading, fontSize: 12, color: colors.surface },
  appName: { flex: 1, fontFamily: fonts.heading, fontSize: 15, color: colors.ink },
  radioOn: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.blue },
  confirm: { gap: 4, padding: 14, borderRadius: 20, backgroundColor: colors.fill },
  help: { gap: 6, padding: 14, borderRadius: 18, backgroundColor: colors.fill },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  receiptHead: { alignItems: "center", gap: 4, paddingVertical: 8 },
  receiptAmount: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 44, color: colors.ink },
  badge: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  badgeWait: { backgroundColor: colors.butter },
  badgeOk: { backgroundColor: colors.tealSoft },
  badgeOff: { backgroundColor: colors.fill },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  rows: { borderRadius: 20, backgroundColor: colors.surface, paddingHorizontal: 14, ...shadows.glass },
  row: { flexDirection: "row", gap: 12, justifyContent: "space-between", alignItems: "center", minHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  rowValue: { flex: 1, textAlign: "right", fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
});
