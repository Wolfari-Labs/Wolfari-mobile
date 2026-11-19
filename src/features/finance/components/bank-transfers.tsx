import { useCallback } from "react";
import { Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { EmptyState, Notice, ResourceFeedback, StatusBadge, ui } from "@/shared/ui/journal";
import { historyTimeLabel } from "../history-labels";
import { money } from "../model";
import type { BankTransfer } from "../types";

const statusLabel: Record<BankTransfer["processing_status"], string> = {
  MATCHED: "Đã ghi vào quỹ",
  NEEDS_REVIEW: "Cần xem lại",
  UNMATCHED: "Chưa khớp",
  IGNORED: "Bỏ qua",
};
const statusTone: Record<BankTransfer["processing_status"], string> = {
  MATCHED: "CONFIRMED",
  NEEDS_REVIEW: "REJECTED",
  UNMATCHED: "PENDING",
  IGNORED: "CANCELLED",
};
const reviewText: Record<string, string> = {
  NO_REFERENCE: "Nội dung chuyển khoản không có mã tham chiếu của khoản góp.",
  UNKNOWN_REFERENCE: "Mã tham chiếu không khớp khoản góp nào của quỹ.",
  MULTIPLE_REFERENCES: "Nội dung có nhiều mã tham chiếu nên không tự ghi.",
  ACCOUNT_MISMATCH: "Tiền về tài khoản khác với tài khoản nhận đã chốt cho khoản góp.",
  AMOUNT_MISMATCH: "Số tiền chuyển khác số tiền phải góp.",
  CONTRIBUTION_NOT_PAYABLE: "Khoản góp không còn ở trạng thái chờ góp (đã hủy, miễn hoặc đổi).",
  ALREADY_CONFIRMED: "Khoản góp này đã được xác nhận trước đó; có thể là chuyển trùng.",
  FUND_NOT_OPEN: "Quỹ không còn mở khi tiền về.",
  VERSION_LIMIT: "Quỹ đã đạt giới hạn phiên bản; liên hệ người quản trị.",
  OUTGOING: "Giao dịch tiền ra, không phải tiền góp.",
};

/** Owner/Holder view of money that reached the fund's bank account through SePay. */
export function BankTransfers({ fundId, timezone }: { fundId: string; timezone: string }) {
  const api = useApi();
  const rows = useResource(useCallback((signal: AbortSignal) => api.finance.bankTransfers(fundId, signal), [api, fundId]));
  const review = rows.data?.filter(row => row.processing_status === "NEEDS_REVIEW").length ?? 0;
  return <View style={ui.stack}>
    <Notice>Tiền chuyển vào tài khoản nhận của quỹ (qua SePay) được tự ghi khi nội dung có đúng mã khoản góp và đủ số tiền. Giao dịch không khớp không được tự ghi; người giữ quỹ đối chiếu rồi xác nhận khoản góp bằng tay.</Notice>
    {review > 0 && <Notice>{review} giao dịch cần xem lại. Kiểm tra người chuyển và số tiền, rồi xác nhận hoặc từ chối khoản góp tương ứng ở tab Đợt góp.</Notice>}
    <ResourceFeedback {...rows} hasData={!!rows.data} onRetry={() => { void rows.reload(); }} />
    {rows.data && !rows.data.length && <EmptyState title="Chưa có tiền về" message="Khi thành viên chuyển khoản với đúng nội dung, giao dịch sẽ hiện ở đây." icon="wallet" />}
    {rows.data?.map(row => <View key={row.id} style={ui.record}>
      <View style={ui.recordHeader}>
        <Text style={typography.headline}>{row.transfer_type === "OUT" ? "−" : "+"}{money(row.amount)}</Text>
        <StatusBadge status={statusTone[row.processing_status]} label={statusLabel[row.processing_status]} />
      </View>
      <Text selectable style={typography.body}>{row.content || "Không có nội dung"}</Text>
      <Text style={typography.footnote}>
        {row.bank_gateway ? `${row.bank_gateway} · ` : ""}TK {row.account_number_masked} · {historyTimeLabel(row.transaction_at ?? row.received_at, timezone)}
      </Text>
      {row.review_reason && <Text style={typography.footnote}>{reviewText[row.review_reason] ?? row.review_reason}</Text>}
      {row.processing_status === "MATCHED" && <Text style={typography.footnote}>Đã tự xác nhận khoản góp tương ứng.</Text>}
    </View>)}
  </View>;
}
