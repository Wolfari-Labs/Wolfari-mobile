import { useCallback, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import type { Page } from "@/features/trips/types";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { EmptyState, ResourceFeedback, ui } from "@/shared/ui/journal";

export function PagedRecords<T extends { id: string }>({ load, render, title }: {
  title: string; load: (cursor: string | undefined, signal: AbortSignal) => Promise<Page<T>>; render: (row: T) => ReactNode;
}) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const resource = useResource(useCallback((signal: AbortSignal) => load(cursor, signal), [load, cursor]));
  return <View style={ui.stack}>
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
    {!resource.loading && resource.data && !resource.data.items.length && <EmptyState title={`Chưa có ${title}`} message="Dữ liệu được đọc từ máy chủ, không dùng số liệu mẫu." icon="wallet" />}
    {resource.data?.items.map(row => <View key={row.id} style={ui.record}>{render(row)}</View>)}
    {resource.data && <View style={ui.stack}>
      <Text style={typography.footnote}>Trang {cursors.length} · tối đa 20 mục mỗi lần tải</Text>
      {cursors.length > 1 && <Button label="Trang trước" variant="soft" disabled={resource.loading} onPress={() => setCursors(current => current.slice(0, -1))} />}
      {resource.data.next_cursor && <Button label="Trang tiếp" variant="soft" disabled={resource.loading || cursors.includes(resource.data.next_cursor)} onPress={() => setCursors(current => [...current, resource.data!.next_cursor!])} />}
    </View>}
  </View>;
}
