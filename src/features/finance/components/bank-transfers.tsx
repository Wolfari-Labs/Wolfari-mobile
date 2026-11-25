import { useCallback } from "react";
import { Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { EmptyState, Notice, ResourceFeedback, StatusBadge, ui } from "@/shared/ui/journal";
import { bankTransferResolutionLabels, bankTransferResolveForm } from "../forms";
import { historyTimeLabel } from "../history-labels";
import { money } from "../model";
import type { FinanceFormSpec } from "./finance-form";
import type { BankTransfer, Fund } from "../types";

const statusLabel: Record<BankTransfer["processing_status"], string> = {
  MATCHED: "Đã ghi vào quỹ",
  NEEDS_REVIEW: "Cần xem lại",
  UNMATCHED: "Chưa khớp",
  IGNORED: "Bỏ qua",
  RESOLVED: "Đã xử lý",
};
const statusTone: Record<BankTransfer["processing_status"], string> = {
  MATCHED: "CONFIRMED",
  NEEDS_REVIEW: "REJECTED",
  UNMATCHED: "PENDING",
  IGNORED: "CANCELLED",
  RESOLVED: "CONFIRMED",
};
const reviewText: Record<string, string> = {
  NO_REFERENCE: "Nội dung chuyển khoản không có mã tham chiếu của khoản góp.",
  UNKNOWN_REFERENCE: "Mã tham chiếu không khớp khoản góp nào của quỹ.",
  MULTIPLE_REFERENCES: "Nội dung có nhiều mã tham chiếu nên không tự ghi.",
  ACCOUNT_MISMATCH: "Thông tin ngân hàng hoặc số tài khoản nhận cần được đối chiếu.",
  AMOUNT_MISMATCH: "Số tiền chuyển khác số tiền phải góp.",
  CONTRIBUTION_NOT_PAYABLE: "Khoản góp không còn ở trạng thái chờ góp (đã hủy, miễn hoặc đổi).",
  ALREADY_CONFIRMED: "Khoản góp này đã được xác nhận trước đó; có thể là chuyển trùng.",
  FUND_NOT_OPEN: "Quỹ không còn mở khi tiền về.",
  VERSION_LIMIT: "Quỹ đã đạt giới hạn phiên bản; liên hệ người quản trị.",
  OUTGOING: "Giao dịch tiền ra, không phải tiền góp.",
};

/** Owner/Holder view of money that reached the fund's bank account through SePay. */
export function BankTransfers({ fund, timezone, holder, writable, locked, open, who }: {
  fund: Fund;
  timezone: string;
  holder: boolean;
  writable: boolean;
  locked: boolean;
  open(spec: FinanceFormSpec): void;
  who(userId: string): string;
}) {
  const api = useApi();
  const rows = useResource(useCallback((signal: AbortSignal) => api.finance.bankTransfers(fund.id, signal), [api, fund.id]));
  const review = rows.data?.filter(row => row.processing_status === "NEEDS_REVIEW").length ?? 0;
  return <View style={ui.stack}>
    <Notice>SePay tự xác nhận khoản góp khi khớp ngân hàng, số tài khoản nhận, mã khoản góp và số tiền. Người giữ quỹ xem lại các giao dịch cần đối chiếu tại đây.</Notice>
    {review > 0 && <Notice>
      {review} giao dịch cần xem lại. Quỹ chỉ chốt được khi đã xử lý hết. Người giữ quỹ hoàn lại tiền hoặc xác nhận tay khoản góp tương ứng ở tab Đợt góp, rồi bấm “Đã xử lý” trên từng giao dịch.
    </Notice>}
    <ResourceFeedback {...rows} hasData={!!rows.data} onRetry={() => { void rows.reload(); }} />
    {rows.data && !rows.data.length && <EmptyState title="Chưa có tiền về" message="Khi thành viên chuyển khoản với đúng nội dung, giao dịch sẽ hiện ở đây." icon="wallet" scene="waiting" />}
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
      {row.processing_status === "RESOLVED" && row.resolution && <>
        <Text style={typography.body}>{bankTransferResolutionLabels[row.resolution]}</Text>
        {row.resolution_note && <Text selectable style={typography.footnote}>Ghi chú: {row.resolution_note}</Text>}
        <Text style={typography.footnote}>
          {row.resolved_by_user_id ? who(row.resolved_by_user_id) : "Người giữ quỹ"}
          {row.resolved_at ? ` · ${historyTimeLabel(row.resolved_at, timezone)}` : ""}
        </Text>
      </>}
      {row.processing_status === "NEEDS_REVIEW" && holder && writable && <View style={ui.actionRow}>
        <Button
          label="Đã xử lý"
          compact
          variant="soft"
          accessibilityLabel={`Đã xử lý · ${money(row.amount)} · ${row.content || "không có nội dung"}`}
          disabled={locked}
          onPress={() => open(bankTransferResolveForm(fund, row))}
        />
      </View>}
      {row.processing_status === "NEEDS_REVIEW" && !holder && <Text style={typography.footnote}>Người giữ quỹ sẽ xử lý giao dịch này.</Text>}
    </View>)}
  </View>;
}
