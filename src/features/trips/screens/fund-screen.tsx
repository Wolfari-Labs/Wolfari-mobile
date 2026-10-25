import { useState } from "react";
import { Text, View } from "react-native";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Heading, Notice, ResourceFeedback, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { DraftCollection } from "../components/draft-collection";
import { fundError, fundSummary, moneyLabel } from "../model/local-parity";
import { dateKey } from "../utils";

const kinds = [{ value: "expense", label: "Khoản chi" }, { value: "contribution", label: "Đóng góp" }, { value: "outside", label: "Ngoài quỹ" }, { value: "refund", label: "Hoàn tiền" }];
export default function FundScreen() {
  const resource = useTrip(), { data, id } = resource;
  const [tab, setTab] = useState("expense");
  const [demo, setDemo] = useState(false);
  return <Screen title="Quỹ nhóm" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
    <Heading title="Dự trù cùng cả nhóm" subtitle={data?.trip.name} />
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <>
      <Notice>Quỹ thật chưa được kết nối. Chưa có số dư được xác nhận. Không thể nạp, chuyển khoản, hoàn tiền hoặc tự trừ quỹ tại đây.</Notice>
      <Button label={demo ? "Ẩn ví dụ quỹ" : "Xem ví dụ quỹ (dữ liệu mẫu)"} variant="soft" onPress={() => setDemo(!demo)} />
      {demo && <View style={[ui.card, { backgroundColor: colors.mint }]}>
        <Text style={typography.headline}>VÍ DỤ MINH HỌA · Không phải quỹ của chuyến đi</Text>
        <Text style={typography.body}>Trạng thái mẫu: Đang mở (OPEN)</Text>
        <Text style={typography.body}>Mục tiêu mẫu: {moneyLabel(10000000)}</Text>
        <Text style={typography.body}>Đóng góp mẫu: {moneyLabel(7000000)}</Text>
        <Text style={typography.body}>Chi mẫu: {moneyLabel(6250000)}</Text>
        <Text style={typography.body}>Số dư sổ mẫu: {moneyLabel(750000)}</Text>
        <Text style={typography.body}>Dự phòng hoàn mẫu: {moneyLabel(250000)}</Text>
        <Text style={typography.headline}>Khả dụng mẫu: {moneyLabel(500000)}</Text>
        <Text style={typography.footnote}>Khi kết nối quỹ: Đang mở → Đang đóng (CLOSING) → Đã đóng (CLOSED). Ứng dụng hiện không thực hiện những chuyển trạng thái này.</Text>
      </View>}
      <Segments scroll items={[...kinds, { value: "history", label: "Lịch sử nháp" }]} value={tab} onChange={setTab} />
      <DraftCollection key={id} scope={id} feature="fund" title="khoản dự kiến" editable={data.plan.permissions.can_edit}
        initial={{ name: "", amount: "", date: dateKey(new Date().toISOString(), data.trip.timezone), kind: tab === "history" ? "expense" : tab, category: "Ăn uống", note: "" }}
        fields={[
          { key: "kind", label: "Loại khoản", options: kinds },
          { key: "name", label: "Nội dung khoản dự kiến" },
          { key: "amount", label: "Số tiền dự kiến (VND)", numeric: true },
          { key: "date", label: "Ngày dự kiến", placeholder: "YYYY-MM-DD" },
          { key: "category", label: "Danh mục", suggestions: ["Ăn uống", "Di chuyển", "Lưu trú", "Vé tham quan", "Khác"] },
          { key: "note", label: "Ghi chú", multiline: true },
        ]} validate={fundError} history={tab === "history"} filter={row => row.kind === tab}
        summary={rows => {
          const totals = fundSummary(rows);
          return <View style={ui.card}>
            <Text style={typography.headline}>DỰ TOÁN TỪ BẢN NHÁP · Không phải số dư thật</Text>
            <Text style={typography.body}>Dự kiến góp: {moneyLabel(totals.contributions)}</Text>
            <Text style={typography.body}>Dự kiến chi: {moneyLabel(totals.expenses)}</Text>
            <Text style={typography.body}>Dự kiến hoàn: {moneyLabel(totals.refunds)}</Text>
            <Text style={typography.headline}>Còn lại dự kiến: {moneyLabel(totals.available)}</Text>
            <Text style={typography.footnote}>Khoản ngoài quỹ không tham gia phép tính. Mọi khoản đều chưa xác nhận.</Text>
          </View>;
        }}
        render={row => <><Text style={typography.headline}>{row.name}</Text><Text style={typography.section}>{moneyLabel(Number(row.amount) || 0)}</Text><Text style={typography.footnote}>{row.date} · {row.category} · Chưa xác nhận (nháp)</Text>{!!row.note && <Text style={typography.body}>{row.note}</Text>}</>} />
    </>}
  </Screen>;
}
