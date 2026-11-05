import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Notice, ResourceFeedback, ui } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { money, statusLabels } from "../model";
import type { Closure } from "../types";

export function ClosureSheet({ closureId, owner, userId, writable, onClose, onAction }: {
  closureId: string; owner: boolean; userId: string; writable: boolean; onClose(): void;
  onAction(row: Closure, action: "confirm" | "cancel" | "remind"): void;
}) {
  const api = useApi();
  const resource = useResource(useCallback((signal: AbortSignal) => api.finance.closure(closureId, signal), [api, closureId]));
  const [expanded, setExpanded] = useState(false);
  const row = resource.data;
  return <Sheet visible title="Bản chốt quỹ" onClose={onClose}>
    <ResourceFeedback {...resource} hasData={!!row} onRetry={() => { void resource.reload(); }} />
    {row && <>
      <Text style={typography.headline}>{statusLabels[row.status]}</Text>
      <Text selectable style={typography.footnote}>Mã bản chốt: {row.snapshot_hash}</Text>
      <Text style={typography.body}>Số dư bản chốt: {money(row.snapshot.fund.current_balance)}</Text>
      <Text style={typography.body}>Phiên bản bản chốt: {row.snapshot_finance_version}</Text>
      {row.confirmations.map(item => <Text key={item.user_id} style={typography.body}>{item.user_id === userId ? "Bạn" : item.user_id.slice(0, 8)} · {item.confirmed_at ? "Đã xác nhận" : "Chưa xác nhận"}</Text>)}
      <Notice>Bản chốt là dữ liệu cố định tại thời điểm yêu cầu đóng, không phải số dư được tính lại trên điện thoại.</Notice>
      <Button label={expanded ? "Thu gọn bản chốt" : "Xem toàn bộ bản chốt"} variant="soft" onPress={() => setExpanded(!expanded)} />
      {expanded && <View style={ui.stack}>
        {([ ["contribution_requests", "Yêu cầu đóng góp"], ["contributions", "Đóng góp"], ["expenses", "Khoản chi"], ["financial_notes", "Khoản ngoài quỹ"], ["refunds", "Hoàn tiền"], ["ledger", "Sổ giao dịch"] ] as const).map(([key, label]) => <SnapshotSection key={key} label={label} rows={row.snapshot[key]} />)}
      </View>}
      {row.status === "PENDING_CONFIRMATIONS" && writable && <>
        {row.confirmations.some(item => item.user_id === userId && !item.confirmed_at) && <Button label="Xác nhận bản chốt này" onPress={() => onAction(row, "confirm")} />}
        {owner && <>
          <Button label="Nhắc thành viên xác nhận" variant="soft" onPress={() => onAction(row, "remind")} />
          <Button label="Hủy phiên đóng quỹ" variant="destructive" onPress={() => onAction(row, "cancel")} />
        </>}
      </>}
    </>}
  </Sheet>;
}

function SnapshotSection({ label, rows }: { label: string; rows: Record<string, unknown>[] }) {
  const [page, setPage] = useState(0);
  return <View style={ui.stack}>
    <Text style={typography.headline}>{label} · {rows.length}</Text>
    {rows.slice(page * 20, (page + 1) * 20).map((entry, index) => <SnapshotRow key={String(entry.id ?? index)} entry={entry} />)}
    {rows.length > 20 && <>
      <Text style={typography.footnote}>Trang {page + 1}/{Math.ceil(rows.length / 20)}</Text>
      {page > 0 && <Button label={`Trang trước · ${label}`} compact variant="soft" onPress={() => setPage(page - 1)} />}
      {(page + 1) * 20 < rows.length && <Button label={`Trang tiếp · ${label}`} compact variant="soft" onPress={() => setPage(page + 1)} />}
    </>}
  </View>;
}

function SnapshotRow({ entry }: { entry: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={ui.card}>
    <Text style={typography.body}>{String(entry.title ?? entry.description ?? entry.transaction_type ?? entry.id)}</Text>
    {typeof entry.amount === "string" && <Text style={typography.headline}>{money(entry.amount)}</Text>}
    {typeof entry.status === "string" && <Text style={typography.footnote}>{statusLabels[entry.status] ?? entry.status}</Text>}
    {typeof entry.direction === "string" && <Text style={typography.footnote}>{entry.direction === "IN" ? "Thu" : "Chi"} · Số dư sau: {money(String(entry.balance_after))}</Text>}
    <Button label="Chi tiết bản ghi" accessibilityLabel={`Chi tiết bản ghi ${String(entry.id)}`} compact variant="soft" onPress={() => setExpanded(!expanded)} />
    {expanded && <Text selectable style={typography.footnote}>{JSON.stringify(entry, null, 2)}</Text>}
  </View>;
}
