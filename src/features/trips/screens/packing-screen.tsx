import { useState } from "react";
import { Text, View } from "react-native";
import { colors, typography } from "@/shared/theme/tokens";
import { Heading, Progress, ResourceFeedback, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Button } from "@/shared/ui/button";
import { useTrip } from "../hooks/use-trip";
import { PackingCompletion } from "../components/packing-completion";
import { DraftCollection } from "../components/draft-collection";
import { packingError } from "../model/local-parity";
import { dateKey } from "../utils";

export default function PackingScreen() {
  const resource = useTrip(), { data, id } = resource;
  const [filter, setFilter] = useState<"all" | "mine" | "todo">("all");
  const [category, setCategory] = useState("all");
  const [celebrate, setCelebrate] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const categories = ["Quần áo", "Vệ sinh", "Giấy tờ", "Điện tử", "Y tế", "Khác"];
  return <Screen title="Hành lý" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
    <Heading title="Sẵn sàng lên đường" subtitle="Chuẩn bị hành lý từ danh sách chung hoặc bản nháp riêng." />
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <>
      <Segments items={[{ value: "all", label: "Tất cả" }, { value: "mine", label: "Của tôi" }, { value: "todo", label: "Chưa xong" }]} value={filter} onChange={setFilter} />
      <Segments scroll value={category} onChange={setCategory} items={[{ value: "all", label: "Mọi danh mục" }, ...[...new Set([...categories, ...data.plan.packing_items.map(p => p.category || "Khác")])].map(value => ({ value, label: value }))]} />
      <DraftCollection key={id} scope={id} feature="packing" title="vật dụng"
        base={JSON.stringify(data.plan.packing_items)}
        seed={data.plan.packing_items.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit ?? "", note: item.note ?? "", category: item.category ?? "Khác", assignee: item.assigned_member_id ?? "", due: item.due_at ? dateKey(item.due_at, data.trip.timezone) : "", reminder: "", status: item.status }))}
        editable={data.plan.permissions.can_edit} completable={data.plan.permissions.can_complete}
        initial={{ name: "", quantity: "1", unit: "món", note: "", category: "Khác", assignee: "", due: "", reminder: "", status: "TODO" }}
        fields={[
          { key: "name", label: "Tên vật dụng", suggestions: ["Áo khoác", "Kem chống nắng", "Sạc dự phòng"] },
          { key: "category", label: "Danh mục", suggestions: categories },
          { key: "quantity", label: "Số lượng", numeric: true }, { key: "unit", label: "Đơn vị" },
          { key: "assignee", label: "Phân công", options: [{ value: "", label: "Chưa phân công" }, { value: data.trip.current_membership.id, label: "Tôi chuẩn bị" }, ...[...new Set(data.plan.packing_items.map(p => p.assigned_member_id).filter((v): v is string => !!v && v !== data.trip.current_membership.id))].map(value => ({ value, label: "Thành viên " + value.slice(-6) }))] },
          { key: "due", label: "Hạn chuẩn bị", placeholder: "YYYY-MM-DD (không bắt buộc)" },
          { key: "reminder", label: "Lời nhắc (chỉ ghi chú, không gửi thông báo)" },
          { key: "note", label: "Ghi chú", multiline: true },
        ]} validate={packingError}
        filter={row => (category === "all" || (row.category || "Khác") === category) && (filter === "all" || (filter === "todo" ? row.status !== "COMPLETED" : row.assignee === data.trip.current_membership.id))}
        groupBy="category"
        toggle={{ key: "status", on: "COMPLETED", off: "TODO", onLabel: "Đánh dấu chưa chuẩn bị (nháp)", offLabel: "Đã chuẩn bị (nháp)" }}
        summary={rows => {
          const done = rows.filter(r => r.status === "COMPLETED").length;
          return <View style={[ui.card, { backgroundColor: colors.mint }]}>
            <Text style={typography.headline}>Tiến độ danh sách đang xem</Text>
            <Text style={typography.largeTitle}>{done} / {rows.length}</Text><Progress done={done} total={rows.length} />
            {!!rows.length && done === rows.length && <Button label="Danh sách đã sẵn sàng!" onPress={() => { setCompletedCount(rows.length); setCelebrate(true); }} />}
          </View>;
        }}
        render={row => <><Text style={typography.headline}>{row.name}</Text><Text style={typography.footnote}>{row.quantity} {row.unit} · {row.status === "COMPLETED" ? "Đã chuẩn bị" : "Chưa chuẩn bị"}</Text>
          <Text style={typography.footnote}>{row.assignee === data.trip.current_membership.id ? "Tôi chuẩn bị" : row.assignee ? "Thành viên " + row.assignee.slice(-6) : "Chưa phân công"}</Text>
          {!!row.due && <Text style={typography.footnote}>Hạn: {row.due}</Text>}{!!row.reminder && <Text style={typography.footnote}>Nhắc: {row.reminder}</Text>}{!!row.note && <Text style={typography.body}>{row.note}</Text>}
        </>} />
      <PackingCompletion visible={celebrate} count={completedCount} onClose={() => setCelebrate(false)} />
    </>}
  </Screen>;
}
