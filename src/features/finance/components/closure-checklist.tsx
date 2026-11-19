import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, radii, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { ResourceFeedback, ui } from "@/shared/ui/journal";
import { closureChecklist, type ChecklistTarget } from "../closure-readiness";
import type { Fund } from "../types";

/**
 * "Trước khi chốt quỹ": the server's own rule list. Every open item is resolved one by one;
 * there is deliberately no bulk waive.
 */
export function ClosureChecklist({ fund, canRequest, locked, onRequest, onOpen }: {
  fund: Fund;
  canRequest: boolean;
  locked: boolean;
  onRequest(): void;
  onOpen(target: ChecklistTarget): void;
}) {
  const api = useApi();
  const readiness = useResource(
    useCallback((signal: AbortSignal) => api.finance.closureReadiness(fund.id, signal), [api, fund.id]),
    fund.status === "OPEN",
  );
  if (fund.status !== "OPEN") return null;
  const items = readiness.data ? closureChecklist(readiness.data) : [];
  const ready = !!readiness.data?.ready;
  return <View style={[ui.card, { gap: 12 }]}>
    <Text accessibilityRole="header" style={typography.headline}>Trước khi chốt quỹ</Text>
    <ResourceFeedback {...readiness} hasData={!!readiness.data} onRetry={() => { void readiness.reload(); }} />
    {readiness.data && (ready
      ? <Text style={[typography.body, { color: colors.teal }]}>✓ Mọi khoản đã xử lý xong và số dư bằng 0. Có thể yêu cầu chốt quỹ.</Text>
      : <Text style={typography.footnote}>Còn {items.length} việc cần xử lý. Mỗi thành viên phải được xử lý riêng; không có thao tác miễn hàng loạt.</Text>)}
    {items.map(item => <View key={item.kind} style={styles.item}>
      <View style={styles.dot} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={typography.headline}>{item.title}</Text>
        <Text style={typography.body}>{item.action}</Text>
        <Text style={typography.footnote}>Ai xử lý: {item.owner}</Text>
        <View style={ui.actionRow}>
          <Button label={item.targetLabel} compact variant="soft" accessibilityLabel={`${item.targetLabel} · ${item.title}`} onPress={() => onOpen(item.target)} />
        </View>
      </View>
    </View>)}
    {canRequest && <Button label="Yêu cầu chốt quỹ" disabled={locked || !ready || readiness.loading} onPress={onRequest} />}
  </View>;
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", gap: 12, padding: 12, borderRadius: radii.control, backgroundColor: colors.fill },
  dot: { width: 10, height: 10, marginTop: 6, borderRadius: 5, backgroundColor: colors.error },
});
