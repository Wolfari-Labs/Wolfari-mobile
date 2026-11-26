import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { historyTimeLabel } from '@/features/finance/history-labels';
import { money } from '@/features/finance/model';
import type { Fund } from '@/features/finance/types';
import { errorMessage } from '@/shared/api/errors';
import { useLocalDraft } from '@/shared/storage/use-local-draft';
import { typography } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Details } from '@/shared/ui/details';
import { Feedback } from '@/shared/ui/feedback';
import { ui } from '@/shared/ui/journal';
import { completeSimulatedExpense, createSimulatedFund, isSimulatedFund, simulatedFundTotals } from '../model/simulated-fund';
import type { PaymentTransfer } from '../model/payment-transfer';
import { PaymentQrEntry } from './payment-qr-entry';

export function FundPaymentTools({ fund, timezone }: { fund: Fund; timezone: string }) {
  const journal = useLocalDraft(fund.id, 'payment-simulation', isSimulatedFund);
  const writing = useRef(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const totals = journal.value ? simulatedFundTotals(journal.value) : undefined;

  async function complete(transfer: PaymentTransfer, paymentId: string) {
    if (!journal.ready || journal.busy || writing.current) return 'Sổ mô phỏng chưa sẵn sàng. Hãy thử lại sau.';
    writing.current = true;
    try {
      const previous = journal.value ?? createSimulatedFund(fund.current_balance, fund.reserved_refund);
      const next = completeSimulatedExpense(previous, {
        id: paymentId, amount: transfer.amount, note: transfer.note, created_at: new Date().toISOString(),
      });
      if (!await journal.save(next)) return 'Chưa lưu được khoản chi mô phỏng trên thiết bị. Hãy thử lại.';
    } catch (cause) { return errorMessage(cause, 'Chưa ghi được khoản chi mô phỏng.'); }
    finally { writing.current = false; }
  }

  return <View style={ui.stack}>
    {journal.value && totals && <View style={ui.card}>
      <Text accessibilityRole="header" style={typography.section}>Sổ quỹ mô phỏng</Text>
      <Text style={typography.footnote}>Chỉ lưu trên thiết bị, riêng cho tài khoản và chuyến đi này.</Text>
      <Text style={typography.headline}>Khả dụng mô phỏng:{'\n'}{money(totals.available)}</Text>
      <Text style={typography.body}>Đã chi mô phỏng: {money(totals.spent)}</Text>
      <Details title={`Lịch sử mô phỏng (${journal.value.entries.length})`}>
        <Text style={typography.footnote}>Số dư khởi đầu: {money(journal.value.opening_balance)}. Giữ riêng khoản hoàn: {money(journal.value.reserved_refund)}. Đặt lại sổ để lấy số dư quỹ hiện tại.</Text>
        {journal.value.entries.slice().reverse().slice(0, visibleCount).map(entry => <View key={entry.id} style={ui.record}>
          <Text style={typography.headline}>{entry.note}</Text>
          <Text style={typography.body}>− {money(entry.amount)} · Đã ghi chi mô phỏng</Text>
          <Text style={typography.footnote}>{historyTimeLabel(entry.created_at, timezone)}</Text>
        </View>)}
        {journal.value.entries.length > visibleCount && <Button label="Xem thêm lịch sử mô phỏng" variant="text" onPress={() => setVisibleCount(count => count + 20)} />}
        <Button label="Đặt lại sổ mô phỏng" variant="text" disabled={journal.busy} onPress={() => { void journal.clear(); }} />
      </Details>
    </View>}
    {journal.error && <>
      <Feedback message={journal.error} />
      {!journal.ready && <Button label="Đặt lại sổ mô phỏng" variant="text" disabled={journal.busy} onPress={() => { void journal.clear(); }} />}
    </>}
    <PaymentQrEntry simulationOnly onSimulatedPayment={complete}
      simulationAvailable={totals?.available ?? fund.available_balance}
      simulationSuccessMessage="Đã trừ số dư và lưu khoản chi vào sổ quỹ mô phỏng của chuyến đi. Đóng màn hình để xem lại số dư và lịch sử."
    />
  </View>;
}
