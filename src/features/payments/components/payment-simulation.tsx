import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { money } from '@/features/finance/model';
import { errorMessage } from '@/shared/api/errors';
import { randomUUID } from '@/shared/operations/operation-id';
import { typography } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Feedback } from '@/shared/ui/feedback';
import { ui } from '@/shared/ui/journal';

/** Success is shown only after the simulated ledger has been updated. */
export function PaymentSimulation({ amount, note, recipient, onSuccess, successMessage }: {
  amount: string; note: string; recipient: string;
  onSuccess: (paymentId: string) => string | undefined | Promise<string | undefined>;
  successMessage?: string;
}) {
  const [status, setStatus] = useState<'review' | 'success' | 'failed'>('review');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const paymentId = useRef<string | undefined>(undefined);
  const completed = useRef(false);
  const paying = useRef(false);
  async function pay() {
    if (completed.current || paying.current) return;
    paying.current = true; setBusy(true); setError(undefined);
    try {
      paymentId.current ??= randomUUID();
      const failure = await onSuccess(paymentId.current);
      if (failure) { setError(failure); return; }
      completed.current = true; setStatus('success');
    } catch (cause) { setError(errorMessage(cause, 'Chưa lưu được thanh toán mô phỏng. Hãy thử lại.')); }
    finally { paying.current = false; setBusy(false); }
  }
  return <View style={ui.card}>
    <Text accessibilityRole="header" style={typography.section}>{status === 'success' ? 'Thanh toán mô phỏng thành công' : status === 'failed' ? 'Thanh toán mô phỏng thất bại' : 'Ví thanh toán mô phỏng'}</Text>
    <Text style={typography.footnote}>MÔ PHỎNG · Không dùng tiền thật</Text>
    <Text style={typography.title}>{money(amount)}</Text>
    <Text style={typography.body}>Người nhận: {recipient}</Text>
    <Text style={typography.body}>Nội dung: {note}</Text>
    {status === 'success' ? <Text style={typography.body}>{successMessage ?? 'Đã cập nhật sổ quỹ mẫu. Bạn có thể đóng màn hình để xem số dư và lịch sử.'}</Text> : status === 'failed' ? <>
      <Text style={typography.body}>Lượt thử này chưa ghi nhận thu hoặc chi.</Text>
      <Button label="Thử lại mô phỏng" variant="soft" onPress={() => setStatus('review')} />
    </> : <>
      <Button label="Xác nhận thanh toán mô phỏng" loading={busy} onPress={() => { void pay(); }} />
      <Button label="Thử tình huống thất bại" variant="text" disabled={busy} onPress={() => { setError(undefined); setStatus('failed'); }} />
    </>}
    {error && <Feedback message={error} />}
  </View>;
}
