import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text } from 'react-native';
import { openPaymentApp } from '@/features/payments/open-payment-app';
import { paymentSandboxEnabled } from '@/features/payments/sandbox-config';
import { useApi } from '@/shared/api/use-api';
import { useResource } from '@/shared/hooks/use-resource';
import { typography } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Feedback } from '@/shared/ui/feedback';
import { ResourceFeedback } from '@/shared/ui/journal';
import { Sheet } from '@/shared/ui/sheet';
import { sandboxPaymentUrl } from '../extended-model';
import { money } from '../model';
import type { PaymentAttempt } from '../types';

const labels: Record<string, string> = { CREATED: 'Đang tạo thanh toán…', PENDING: 'Chờ thanh toán', SUCCEEDED: 'Thanh toán thử thành công', FAILED: 'Thanh toán không thành công', EXPIRED: 'Thanh toán đã hết hạn', CANCELLED: 'Đã hủy thanh toán' };
export function MomoPaymentSheet({ attempt, onClose, onUpdate, onRetry }: { attempt: PaymentAttempt; onClose(): void; onUpdate(): Promise<unknown>; onRetry?: () => void }) {
  const api = useApi();
  const [openError, setOpenError] = useState<string>();
  const notified = useRef(false);
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    const row = await api.finance.attempt(attempt.id, signal);
    if (row.id !== attempt.id || row.contribution_id !== attempt.contribution_id || row.amount !== attempt.amount || row.currency !== 'VND' || row.provider !== 'MOMO_SANDBOX' || row.environment !== 'SANDBOX') throw Error('Thông tin thanh toán không khớp khoản góp.');
    if (row.payment_url) sandboxPaymentUrl(row.payment_url);
    return row;
  }, [api, attempt.id, attempt.contribution_id, attempt.amount]));
  const row = resource.data;
  const reload = resource.reload;
  useFocusEffect(useCallback(() => {
    const refresh = () => { if (AppState.currentState === 'active') void reload(); };
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const timer = row && ['CREATED', 'PENDING'].includes(row.status) ? setInterval(refresh, 4000) : undefined;
    return () => { listener.remove(); if (timer) clearInterval(timer); };
  }, [reload, row]));
  useEffect(() => {
    if (row?.status === 'SUCCEEDED' && !notified.current) { notified.current = true; void onUpdate(); }
  }, [row?.status, onUpdate]);
  return <Sheet visible title="Góp quỹ qua MoMo Test" onClose={onClose}>
    <Text style={typography.section}>{money(attempt.amount)}</Text>
    <Text style={typography.footnote}>Môi trường thử nghiệm, không chuyển tiền thật.</Text>
    <ResourceFeedback {...resource} hasData={!!row} onRetry={() => { void reload(); }} />
    {row && <>
      <Text style={typography.headline}>{labels[row.status] ?? 'Đang đối chiếu thanh toán'}</Text>
      {row.needs_reconciliation && <Text style={typography.body}>Kết quả cần người giữ quỹ đối soát tại công cụ quỹ.</Text>}
      {paymentSandboxEnabled && row.payment_url && row.status === 'PENDING' && !row.needs_reconciliation && <Button label="Mở MoMo Test" onPress={() => {
        setOpenError(undefined);
        void openPaymentApp(sandboxPaymentUrl(row.payment_url!)).catch(() => setOpenError('Không mở được thanh toán. Kiểm tra đã cài MoMo Test rồi thử lại.'));
      }} />}
      {openError && <Feedback message={openError} />}
      {row.status !== 'SUCCEEDED' && <Button label="Kiểm tra kết quả thanh toán" variant="soft" disabled={resource.loading} onPress={() => { void reload(); }} />}
      {paymentSandboxEnabled && onRetry && !row.needs_reconciliation && ['FAILED', 'EXPIRED', 'CANCELLED'].includes(row.status) && <Button label="Tạo lần thanh toán mới" variant="soft" onPress={onRetry} />}
    </>}
    {paymentSandboxEnabled && <Text style={typography.footnote}>Sau khi thanh toán, quay lại đây. App cập nhật khoản góp theo kết quả xác minh từ máy chủ.</Text>}
  </Sheet>;
}
