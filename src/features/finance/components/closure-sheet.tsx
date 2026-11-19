import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Details } from "@/shared/ui/details";
import { Notice, ResourceFeedback, ui } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { money, statusLabels } from "../model";
import type { Closure } from "../types";

export function ClosureSheet({ closureId, owner, userId, who, writable, busy, blockedReason, onClose, onAction }: {
  closureId: string; owner: boolean; userId: string; who(userId: string): string; writable: boolean; onClose(): void;
  busy: boolean; blockedReason?: string;
  onAction(row: Closure, action: "confirm" | "cancel" | "remind"): void;
}) {
  const api = useApi();
  const resource = useResource(useCallback((signal: AbortSignal) => api.finance.closure(closureId, signal), [api, closureId]));
  const [expanded, setExpanded] = useState(false);
  const row = resource.data;
  const disabled = busy || !!blockedReason || resource.loading || !!resource.error;
  return <Sheet visible title="Bản chốt quỹ" dismissible={!busy} onClose={onClose}>
    <ResourceFeedback {...resource} hasData={!!row} onRetry={() => { void resource.reload(); }} />
    {row && <>
      <Text style={typography.headline}>{statusLabels[row.status]}</Text>
      <Text style={typography.body}>Số dư bản chốt: {money(row.snapshot.fund.current_balance)}</Text>
      {row.confirmations.map(item => <Text key={item.user_id} style={typography.body}>{who(item.user_id)} · {item.confirmed_at ? "Đã xác nhận" : "Chưa xác nhận"}</Text>)}
      {row.status === "PENDING_CONFIRMATIONS" && writable && <>
        {blockedReason && <Notice>{blockedReason}</Notice>}
        {row.confirmations.some(item => item.user_id === userId && !item.confirmed_at) && <>
          <Text style={typography.footnote}>Bạn xác nhận số liệu trong bản chốt này. Khi đủ mọi người xác nhận, quỹ đóng và chỉ còn xem lịch sử.</Text>
          <Button label="Xác nhận bản chốt này" loading={busy} disabled={disabled} onPress={() => onAction(row, "confirm")} />
        </>}
        {owner && <Details title="Tùy chọn chốt quỹ">
          <Button label="Nhắc thành viên xác nhận" variant="soft" disabled={disabled} onPress={() => onAction(row, "remind")} />
          <Button label="Hủy phiên chốt quỹ" variant="destructive" disabled={disabled} onPress={() => onAction(row, "cancel")} />
        </Details>}
      </>}
      <Text style={typography.footnote}>Bản chốt giữ nguyên số liệu tại lúc yêu cầu chốt quỹ.</Text>
      <Button label={expanded ? "Thu gọn bản chốt" : "Xem toàn bộ bản chốt"} variant="soft" onPress={() => setExpanded(!expanded)} />
      {expanded && <View style={ui.stack}>
        {([ ["contribution_requests", "Yêu cầu đóng góp"], ["contributions", "Đóng góp"], ["expenses", "Khoản chi"], ["financial_notes", "Khoản ngoài quỹ"], ["refunds", "Hoàn tiền"], ["ledger", "Sổ giao dịch"] ] as const).map(([key, label]) => <SnapshotSection key={key} label={label} rows={row.snapshot[key]} who={who} />)}
      </View>}
    </>}
  </Sheet>;
}

const txLabels: Record<string, string> = { CONTRIBUTION: "Đóng góp", EXPENSE: "Khoản chi", REFUND: "Hoàn tiền", REVERSAL: "Bút toán đảo" };

function SnapshotSection({ label, rows, who }: { label: string; rows: Record<string, unknown>[]; who(userId: string): string }) {
  const [page, setPage] = useState(0);
  return <View style={ui.stack}>
    <Text style={typography.headline}>{label} · {rows.length}</Text>
    {rows.slice(page * 20, (page + 1) * 20).map((entry, index) => <SnapshotRow key={String(entry.id ?? index)} entry={entry} who={who} />)}
    {rows.length > 20 && <>
      <Text style={typography.footnote}>Trang {page + 1}/{Math.ceil(rows.length / 20)}</Text>
      {page > 0 && <Button label={`Trang trước · ${label}`} compact variant="soft" onPress={() => setPage(page - 1)} />}
      {(page + 1) * 20 < rows.length && <Button label={`Trang tiếp · ${label}`} compact variant="soft" onPress={() => setPage(page + 1)} />}
    </>}
  </View>;
}

function SnapshotRow({ entry, who }: { entry: Record<string, unknown>; who(userId: string): string }) {
  const txType = typeof entry.transaction_type === "string" ? txLabels[entry.transaction_type] ?? "Giao dịch quỹ" : undefined;
  const member = typeof entry.member_user_id === "string" ? who(entry.member_user_id) : undefined;
  const primary = String(entry.title ?? entry.description ?? entry.reason ?? txType ?? member ?? "Bản ghi");
  return <View style={ui.card}>
    <Text style={typography.body}>{primary}</Text>
    {typeof entry.amount === "string" && <Text style={typography.headline}>{money(entry.amount)}</Text>}
    {member && primary !== member && <Text style={typography.footnote}>{member}</Text>}
    {typeof entry.status === "string" && <Text style={typography.footnote}>{statusLabels[entry.status] ?? "Chưa có thông tin trạng thái"}</Text>}
    {typeof entry.direction === "string" && <Text style={typography.footnote}>{entry.direction === "IN" ? "Thu" : "Chi"} · Số dư sau: {money(String(entry.balance_after))}</Text>}
  </View>;
}
