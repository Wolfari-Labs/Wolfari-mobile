import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text } from 'react-native';
import { openPaymentApp } from '@/features/payments/open-payment-app';
import { useApi } from '@/shared/api/use-api';
import { useResource } from '@/shared/hooks/use-resource';
import { colors, typography } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Feedback } from '@/shared/ui/feedback';
import { ResourceFeedback } from '@/shared/ui/journal';
import { Sheet } from '@/shared/ui/sheet';
import { money } from '../model';
import { payosCheckoutUrl, payosStatusLabel } from '../payos';
import type { PaymentAttempt } from '../types';

/**
 * Real-money checkout. The app only opens payOS's page and reads the attempt back; the server
 * confirms the contribution when payOS's signed webhook (or reconciliation) proves the transfer.
 */
export function PayosPaymentSheet({ attempt, onClose, onUpdate, onRetry }: {
  attempt: PaymentAttempt;
  onClose(): void;
  onUpdate(): Promise<unknown>;
  onRetry?: () => void;
}) {
  const api = useApi();
  const [openError, setOpenError] = useState<string>();
  const opened = useRef(false), notified = useRef(false);
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    const row = await api.finance.attempt(attempt.id, signal);
    if (row.id !== attempt.id || row.contribution_id !== attempt.contribution_id || row.amount !== attempt.amount
      || row.currency !== 'VND' || row.provider !== 'PAYOS' || row.environment !== 'LIVE')
      throw Error('Thông tin thanh toán không khớp khoản góp.');
    if (row.payment_url) payosCheckoutUrl(row.payment_url);
    return row;
  }, [api, attempt.id, attempt.contribution_id, attempt.amount]));
  const row = resource.data, reload = resource.reload;
  const waiting = !!row && (['CREATED', 'PENDING'].includes(row.status) || (row.needs_reconciliation && row.status !== 'SUCCEEDED'));
  useFocusEffect(useCallback(() => {
    const refresh = () => { if (AppState.currentState === 'active') void reload(); };
    // Coming back from the bank app or the payOS page re-reads the result immediately.
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const timer = waiting ? setInterval(refresh, 3000) : undefined;
    return () => { listener.remove(); if (timer) clearInterval(timer); };
  }, [reload, waiting]));
  const open = useCallback((url: string) => {
    setOpenError(undefined);
    void openPaymentApp(payosCheckoutUrl(url)).catch(() => setOpenError('Không mở được trang thanh toán payOS. Thử lại.'));
  }, []);
  useEffect(() => {
    // Open payOS once as soon as its link exists, like a checkout in any shopping app.
    if (!opened.current && row?.status === 'PENDING' && row.payment_url && !row.needs_reconciliation) {
      opened.current = true;
      open(row.payment_url);
    }
  }, [row?.status, row?.payment_url, row?.needs_reconciliation, open]);
  useEffect(() => {
    if (row?.status === 'SUCCEEDED' && !notified.current) { notified.current = true; void onUpdate(); }
  }, [row?.status, onUpdate]);
  return <Sheet visible title="Thanh toán qua payOS" onClose={onClose}>
    <Text style={typography.section}>{money(attempt.amount)}</Text>
    <Text style={typography.footnote}>Tiền thật: chuyển khoản qua VietQR vào đúng tài khoản nhận của quỹ.</Text>
    {/* Seen with ACB: payOS's page shows its own virtual account (e.g. LOCC…), which forwards to the Holder's. */}
    {row?.status !== 'SUCCEEDED' && <Text style={typography.footnote}>Trang payOS có thể hiện số tài khoản ảo của payOS, khác số tài khoản của quỹ: tiền vẫn về tài khoản người giữ quỹ. Giữ nguyên số tiền và nội dung; không chuyển từ chính tài khoản nhận.</Text>}
    <ResourceFeedback {...resource} hasData={!!row} onRetry={() => { void reload(); }} />
    {row && <>
      <Text style={[typography.headline, row.status === 'SUCCEEDED' ? { color: colors.teal } : null]}>{payosStatusLabel(row.status, row.needs_reconciliation)}</Text>
      {row.status === 'SUCCEEDED' && <Text style={typography.body}>Khoản góp đã được xác nhận tự động. Người giữ quỹ cũng nhận được thông báo.</Text>}
      {row.needs_reconciliation && row.status !== 'SUCCEEDED' && <Text style={typography.body}>Wolfari đang hỏi payOS kết quả. Nếu đã chuyển tiền, không chuyển lại: khoản góp sẽ tự cập nhật hoặc người giữ quỹ đối soát.</Text>}
      {row.status === 'PENDING' && row.payment_url && !row.needs_reconciliation && <Button label="Mở trang thanh toán payOS" onPress={() => open(row.payment_url!)} />}
      {row.status === 'CREATED' && <Text style={typography.footnote}>Đang tạo link thanh toán, vui lòng chờ vài giây.</Text>}
      {openError && <Feedback message={openError} />}
      {row.status !== 'SUCCEEDED' && <Button label="Kiểm tra kết quả" variant="soft" disabled={resource.loading} onPress={() => { void reload(); }} />}
      {onRetry && !row.needs_reconciliation && ['FAILED', 'EXPIRED'].includes(row.status) && <Button label="Tạo link thanh toán mới" variant="soft" onPress={onRetry} />}
      {row.status === 'SUCCEEDED' && <Button label="Xong" onPress={onClose} />}
    </>}
    {row?.status !== 'SUCCEEDED' && <Text style={typography.footnote}>Thanh toán xong, quay lại Wolfari. Trạng thái tự cập nhật khi ngân hàng báo tiền đã về.</Text>}
  </Sheet>;
}
