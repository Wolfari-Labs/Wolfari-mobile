import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { money } from '@/features/finance/model';
import { randomUUID } from '@/shared/operations/operation-id';
import { typography } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Feedback } from '@/shared/ui/feedback';
import { ui } from '@/shared/ui/journal';

/** Local demonstration only. Never opens a wallet, sends a callback or writes a real ledger. */
export function PaymentSimulation({ amount, note, recipient, onSuccess }: {
  amount: string; note: string; recipient: string;
  onSuccess?: (paymentId: string) => string | undefined;
}) {
  const [status, setStatus] = useState<'review' | 'success' | 'failed'>('review');
  const [error, setError] = useState<string>();
  const paymentId = useRef<string | undefined>(undefined);
  const completed = useRef(false);
  function pay() {
    if (completed.current) return;
    paymentId.current ??= randomUUID();
    const failure = onSuccess?.(paymentId.current);
    if (failure) { setError(failure); return; }
    completed.current = true; setError(undefined); setStatus('success');
  }
  return <View style={ui.card}>
    <Text accessibilityRole="header" style={typography.section}>{status === 'success' ? 'Thanh toán mô phỏng thành công' : status === 'failed' ? 'Thanh toán mô phỏng thất bại' : 'Ví thanh toán mô phỏng'}</Text>
    <Text style={typography.footnote}>MÔ PHỎNG · Không dùng tiền thật</Text>
    <Text style={typography.title}>{money(amount)}</Text>
    <Text style={typography.body}>Người nhận: {recipient}</Text>
    <Text style={typography.body}>Nội dung: {note}</Text>
    {status === 'success' ? <Text style={typography.body}>{onSuccess ? 'Đã cập nhật sổ quỹ mẫu. Bạn có thể đóng màn hình để xem số dư và lịch sử.' : 'Đã hoàn tất lượt thử. Sổ quỹ trên máy chủ giữ nguyên.'}</Text> : status === 'failed' ? <>
      <Text style={typography.body}>Lượt thử này chưa ghi nhận thu hoặc chi.</Text>
      <Button label="Thử lại mô phỏng" variant="soft" onPress={() => setStatus('review')} />
    </> : <>
      <Button label="Xác nhận thanh toán mô phỏng" onPress={pay} />
      <Button label="Thử tình huống thất bại" variant="text" onPress={() => { setError(undefined); setStatus('failed'); }} />
    </>}
    {error && <Feedback message={error} />}
  </View>;
}
