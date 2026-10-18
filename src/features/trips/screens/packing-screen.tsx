import { useState } from "react";
import { Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { DesignIcon } from "@/shared/ui/design-icon";
import { EmptyState, Heading, Notice, Progress, ResourceFeedback, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { PackingCompletion } from "../components/packing-completion";
import { Button } from "@/shared/ui/button";

export default function PackingScreen() {
  const resource = useTrip(); const { data } = resource;
  const [filter, setFilter] = useState<"all" | "mine" | "todo">("all");
  const [celebrate, setCelebrate] = useState(false);
  const items = data?.plan.packing_items ?? [], done = items.filter(item => item.status === "COMPLETED").length;
  const visible = items.filter(item => filter === "all" || (filter === "todo" ? item.status === "TODO" : item.assigned_member_id === data?.trip.current_membership.id));
  return <Screen title="Hành lý" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
    <Heading title="Sẵn sàng lên đường" subtitle="Cùng chuẩn bị, chẳng lo bỏ sót." /><ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <><View style={[ui.card, { backgroundColor: colors.mint }]}><Text style={[typography.largeTitle, { color: colors.teal }]}>{done} / {items.length}</Text><Progress done={done} total={items.length} /><Text style={typography.footnote}>{items.length ? `Còn ${items.length - done} món cần chuẩn bị.` : "Chờ nhóm thêm những món đồ đầu tiên."}</Text></View><Segments items={[{ value: "all", label: "Tất cả" }, { value: "mine", label: "Của tôi" }, { value: "todo", label: "Chưa xong" }]} value={filter} onChange={setFilter} /><Text accessibilityRole="header" style={[typography.section, { marginTop: 12 }]}>Danh sách vật dụng</Text>
      {visible.map(item => <View key={item.id} style={ui.link}><View style={[ui.rowIcon, { backgroundColor: item.status === "COMPLETED" ? colors.mint : colors.tealSoft }]}><DesignIcon name={item.status === "COMPLETED" ? "check" : "bag"} tintColor={colors.teal} /></View><View style={ui.flex}><Text style={typography.headline}>{item.name}</Text><Text style={typography.footnote}>{item.quantity} {item.unit ?? "món"}{item.category ? ` · ${item.category}` : ""}{item.status === "COMPLETED" ? " · Đã chuẩn bị" : ""}</Text>{item.note && <Text style={typography.footnote}>{item.note}</Text>}</View></View>)}
      {!visible.length && <EmptyState title={items.length ? "Đã xem hết rồi" : "Hành lý còn trống"} message={items.length ? "Không có vật dụng phù hợp với bộ lọc này." : "Những vật dụng nhóm chia sẻ sẽ xuất hiện tại đây."} />}
      <Notice>Danh sách đang ở chế độ xem. Bạn có thể kéo xuống để cập nhật tiến độ mới nhất của nhóm.</Notice>
      {items.length > 0 && done === items.length && <Button label="Cả nhóm đã sẵn sàng!" onPress={() => setCelebrate(true)} />}
      <PackingCompletion visible={celebrate} count={items.length} onClose={() => setCelebrate(false)} />
    </>}
  </Screen>;
}
