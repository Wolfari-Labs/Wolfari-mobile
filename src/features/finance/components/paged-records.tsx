import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import type { Page } from "@/features/trips/types";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { EmptyState, FadeInView, ResourceFeedback, ui } from "@/shared/ui/journal";

export function PagedRecords<T extends { id: string }>({ load, render, title, version }: {
  /** Reloads the current page when the fund version changes. */
  version?: number;
  title: string; load: (cursor: string | undefined, signal: AbortSignal) => Promise<Page<T>>; render: (row: T) => ReactNode;
}) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const resource = useResource(useCallback((signal: AbortSignal) => load(cursor, signal), [load, cursor]));
  const seen = useRef(version);
  const reload = resource.reload;
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    void reload();
  }, [version, reload]);
  return <FadeInView>
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
    {!resource.loading && resource.data && !resource.data.items.length && <EmptyState title={`Chưa có ${title}`} message="Khi có, mục này sẽ hiện ở đây." icon="wallet" />}
    {resource.data?.items.map(row => <View key={row.id} style={ui.record}>{render(row)}</View>)}
    {/* Page controls only when there is more than one page. */}
    {resource.data && (!!resource.data.next_cursor || cursors.length > 1) && <View style={ui.recordHeader}>
      <Text style={typography.footnote}>Trang {cursors.length}</Text>
      <View style={ui.actionRow}>
        {cursors.length > 1 && <Button label="Trang trước" compact variant="soft" disabled={resource.loading} onPress={() => setCursors(current => current.slice(0, -1))} />}
        {resource.data.next_cursor && <Button label="Trang tiếp" compact variant="soft" disabled={resource.loading || cursors.includes(resource.data.next_cursor)} onPress={() => setCursors(current => [...current, resource.data!.next_cursor!])} />}
      </View>
    </View>}
  </FadeInView>;
}
