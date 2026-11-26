import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, Text, View } from 'react-native';

import { AUTOFILL_BANK_APPS } from '@/features/finance/extended-model';
import { money } from '@/features/finance/model';
import { resolveVietQrBank } from '@/features/finance/vietqr-banks';
import { ApiError } from '@/shared/api/api-client';
import { useApi } from '@/shared/api/use-api';
import { errorMessage } from '@/shared/api/errors';
import { randomUUID } from '@/shared/operations/operation-id';
import { colors, typography } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Details } from '@/shared/ui/details';
import { Feedback } from '@/shared/ui/feedback';
import { FormField } from '@/shared/ui/form-field';
import { MoneyField } from '@/shared/ui/money-field';
import { Notice, ui } from '@/shared/ui/journal';
import { useKeyboardScroll } from '@/shared/ui/keyboard-scroll';
import type { QrSandboxCheckout, QrSandboxInput } from '../api';
import type { PaymentQr } from '../model/payment-qr';
import { paymentTransfer, sandboxAmount, scannedBankDeeplink, type PaymentTransfer } from '../model/payment-transfer';
import { openPaymentApp } from '../open-payment-app';
import { paymentSandboxEnabled } from '../sandbox-config';
import { PaymentSimulation } from './payment-simulation';

export type PaymentSimulationOptions = {
  simulationOnly?: boolean;
  simulationAvailable?: string;
  simulationSuccessMessage?: string;
  onSimulatedPayment?: (transfer: PaymentTransfer, paymentId: string) => string | undefined | Promise<string | undefined>;
};
export function PaymentQrTransfer({ payment, tripId, simulationOnly = false, onSimulatedPayment, simulationAvailable, simulationSuccessMessage }: { payment: PaymentQr; tripId?: string } & PaymentSimulationOptions) {
  const api = useApi();
  const [amount, setAmount] = useState(payment.amount ?? '');
  const [note, setNote] = useState(payment.note ?? '');
  const [prepared, setPrepared] = useState<PaymentTransfer>();
  const [selected, setSelected] = useState<string>();
  const [checkout, setCheckout] = useState<QrSandboxCheckout>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sandboxDisabled, setSandboxDisabled] = useState(false);
  const showSandbox = !simulationOnly && paymentSandboxEnabled && !!tripId;
  const scrollRef = useKeyboardScroll()?.scrollRef;
  const lock = useRef(false), active = useRef(true);
  const request = useRef<QrSandboxInput | undefined>(undefined);
  const abort = useRef<AbortController | undefined>(undefined);
  useEffect(() => { active.current = true; return () => { active.current = false; abort.current?.abort(); }; }, []);
  useEffect(() => {
    // Editing with the keyboard can leave the review halfway under the header.
    // Each step starts with the receiving account visible again.
    scrollRef?.current?.scrollTo({ y: 0, animated: false });
  }, [prepared, sandboxDisabled, scrollRef]);

  async function open(url: string) {
    try {
      await openPaymentApp(url);
      if (active.current) setMessage(undefined);
    } catch { if (active.current) setMessage('Không mở được ứng dụng thanh toán. Kiểm tra ứng dụng đã cài, hoặc dùng thông tin chuyển khoản phía trên.'); }
  }

  async function startSandbox() {
    if (lock.current || !prepared || !tripId || !showSandbox || sandboxDisabled) return;
    lock.current = true; setBusy(true); setMessage(undefined);
    try {
      sandboxAmount(prepared.amount);
      request.current ??= { request_id: randomUUID(), amount: prepared.amount, note: prepared.note };
      abort.current = new AbortController();
      const row = await api.payments.sandboxCheckout(tripId, request.current, abort.current.signal);
      if (!active.current) return;
      setCheckout(row);
      if (Platform.OS !== 'web') await open(row.payment_url);
    } catch (cause) {
      if (active.current && cause instanceof ApiError && cause.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
        setSandboxDisabled(true);
        setSelected(undefined);
        setMessage(undefined);
        return;
      }
      if (active.current) setMessage(cause instanceof ApiError && cause.status === 403
        ? 'Chỉ người giữ quỹ hiện tại được dùng chức năng này. Hãy tải lại quỹ.'
        : cause instanceof ApiError && cause.status === 404
          ? 'Không còn truy cập quỹ hoặc chức năng thanh toán này. Hãy tải lại quỹ.'
        : cause instanceof ApiError && cause.status === 503
          ? 'MoMo Test đang tạm gián đoạn. Bạn có thể thử lại hoặc chọn ngân hàng.'
          : errorMessage(cause, 'Chưa tạo được liên kết MoMo Sandbox. Bạn có thể thử lại cùng lần thử.'));
    } finally { lock.current = false; if (active.current) setBusy(false); }
  }

  return <View style={ui.stack}>
    {!prepared ? <>
      {!payment.amount && <Text style={typography.footnote}>Nhập số tiền bạn muốn chuyển (mã QR hoặc thông tin nhập tay chưa có số tiền).</Text>}
      <MoneyField label="Số tiền chuyển (VND)" value={amount} onChangeText={value => { setAmount(value); setMessage(undefined); }} maxDigits={13} placeholder="Ví dụ: 150.000" />
      {/^[1-9]\d{0,12}$/.test(amount) && <Text style={typography.headline}>{money(amount)}</Text>}
      <FormField icon="edit" label="Nội dung chuyển khoản" value={note} onChangeText={value => { setNote(value); setMessage(undefined); }} maxLength={150} placeholder="Ví dụ: Thanh toan bua toi" />
      <Button label="Chọn ứng dụng thanh toán" onPress={() => {
        try { const next = paymentTransfer(payment, amount, note); Keyboard.dismiss(); setPrepared(next); setSelected(simulationOnly ? 'simulation' : showSandbox && !sandboxDisabled ? 'momo' : undefined); setMessage(undefined); }
        catch (cause) { setMessage(errorMessage(cause)); }
      }} />
    </> : <>
      <Text accessibilityRole="header" style={typography.headline}>Ứng dụng thanh toán</Text>
      <Text selectable style={typography.title}>{money(prepared.amount)}</Text>
      <Text selectable style={typography.body}>{prepared.note}</Text>
      {sandboxDisabled && <Notice>MoMo Test chưa được bật. Chọn ngân hàng để tiếp tục chuyển khoản.</Notice>}
      <View accessibilityRole="radiogroup" accessibilityLabel="Ứng dụng thanh toán" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, overflow: 'hidden' }}>
      {onSimulatedPayment && <Pressable cssInterop={false} accessibilityRole="radio" accessibilityLabel="Mô phỏng trong app" accessibilityState={{ checked: selected === 'simulation', disabled: busy }} aria-checked={selected === 'simulation'} disabled={busy}
        onPress={() => { setSelected('simulation'); setMessage(undefined); }} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: selected === 'simulation' ? colors.mint : colors.surface }}>
        <Text style={[typography.body, { flex: 1 }]}>Mô phỏng trong app · Miễn phí</Text><Text style={typography.body}>{selected === 'simulation' ? '●' : '○'}</Text>
      </Pressable>}
      {!simulationOnly && <>
      {showSandbox && <Pressable cssInterop={false} accessibilityRole="radio" accessibilityLabel="MoMo Test" accessibilityState={{ checked: selected === 'momo', disabled: busy || sandboxDisabled }} aria-checked={selected === 'momo'} aria-disabled={busy || sandboxDisabled} disabled={busy || sandboxDisabled}
        onPress={() => { setSelected('momo'); setMessage(undefined); }} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: selected === 'momo' ? colors.mint : colors.surface }}>
        <Text style={[typography.body, { flex: 1 }]}>{sandboxDisabled ? 'MoMo Test · Chưa được bật' : 'MoMo Test · Thanh toán thử'}</Text><Text style={typography.body}>{selected === 'momo' ? '●' : '○'}</Text>
      </Pressable>}
      <View style={{ paddingHorizontal: 12 }}><Details key={sandboxDisabled ? 'momo-disabled' : 'normal'} title="Chuyển bằng ngân hàng" defaultOpen={!showSandbox || sandboxDisabled}>
      {AUTOFILL_BANK_APPS.map(app => <Pressable cssInterop={false} key={app.id} accessibilityRole="radio"
        accessibilityLabel={`Chọn ${app.name}`} accessibilityState={{ checked: selected === app.id, disabled: busy || !resolveVietQrBank(payment.bankBin) }} aria-checked={selected === app.id} aria-disabled={busy || !resolveVietQrBank(payment.bankBin)} disabled={busy || !resolveVietQrBank(payment.bankBin)}
        onPress={() => { setSelected(app.id); setMessage(undefined); }} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: selected === app.id ? colors.mint : colors.surface }}>
        <Text style={[typography.body, { flex: 1 }]}>{app.name}</Text><Text style={typography.body}>{selected === app.id ? '●' : '○'}</Text>
      </Pressable>)}
      </Details></View>
      </>}
      </View>
      {!resolveVietQrBank(payment.bankBin) && <Notice>Ngân hàng nhận chưa có trong danh mục. Bạn có thể sao chép thông tin để chuyển khoản thủ công.</Notice>}
      {selected === 'simulation' ? <>
        {simulationAvailable !== undefined && <Text style={typography.headline}>Khả dụng mô phỏng:{'\n'}{money(simulationAvailable)}</Text>}
        {onSimulatedPayment && <PaymentSimulation amount={prepared.amount} note={prepared.note} recipient={prepared.recipientLabel || prepared.account}
          onSuccess={paymentId => onSimulatedPayment(prepared, paymentId)} successMessage={simulationSuccessMessage} />}
      </> : selected === 'momo' ? <>
        <Text style={typography.footnote}>MoMo Test dùng tiền thử, không chuyển vào tài khoản QR hoặc cập nhật quỹ.</Text>
        {checkout ? <>
          <Button label="Mở lại MoMo Test" onPress={() => { void open(checkout.payment_url); }} />
        </> : <Button label={busy ? 'Đang tạo liên kết thử…' : 'Mở MoMo Test'} loading={busy} onPress={() => { void startSandbox(); }} />}
      </> : selected ? <>
        <Text style={typography.footnote}>Thông tin chuyển khoản sẽ qua VietQR.io để mở ngân hàng. Bạn kiểm tra và xác nhận tại đó.</Text>
        <Button label="Mở ứng dụng ngân hàng" disabled={busy} onPress={() => {
          try { void open(scannedBankDeeplink(prepared, selected)); }
          catch (cause) { setMessage(errorMessage(cause)); }
        }} />
      </> : null}
      <Button label="Sửa số tiền và nội dung" variant="text" disabled={busy} onPress={() => {
        setPrepared(undefined); setSelected(undefined); setCheckout(undefined); request.current = undefined; setMessage(undefined);
      }} />
    </>}
    {message && <Feedback message={message} />}
  </View>;
}
