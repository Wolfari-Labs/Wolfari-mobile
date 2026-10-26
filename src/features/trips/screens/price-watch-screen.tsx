import { useState } from "react";
import { Text, View } from "react-native";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Heading, Notice, ResourceFeedback, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { DraftCollection } from "../components/draft-collection";
import { moneyLabel, watchError } from "../model/local-parity";
import { dateKey } from "../utils";

const cabins = [{ value: "economy", label: "Phổ thông" }, { value: "premium", label: "Phổ thông đặc biệt" }, { value: "business", label: "Thương gia" }];
export default function PriceWatchScreen() {
  const resource = useTrip(), { data, id } = resource;
  const [filter, setFilter] = useState("all");
  const [demo, setDemo] = useState(false);
  return <Screen title="Theo dõi giá vé" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
    <Heading title="Chờ một mức giá đẹp" subtitle={data?.trip.name} />
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <>
      <Notice>Chỉ lập yêu cầu nháp. Chưa lấy giá vé trực tiếp, chưa đăng ký theo dõi hay gửi cảnh báo giá.</Notice>
      <Button variant="soft" label={demo ? "Ẩn lịch sử giá mẫu" : "Xem lịch sử giá mẫu"} onPress={() => setDemo(!demo)} />
      {demo && <View style={ui.card}>
        <Text style={typography.headline}>DỮ LIỆU MẪU · SGN → DAD</Text>
        <Text style={typography.footnote}>Nguồn: Fixture Air Search · Không dùng để đặt vé</Text>
        <Text style={typography.body}>Ngưỡng mẫu: {moneyLabel(2500000)}</Text>
        <Text style={typography.headline}>Giá mẫu gần nhất: {moneyLabel(2350000)}</Text>
        <Text style={typography.footnote}>Quan sát mẫu: 12/09/2026 · Không phải giá hiện tại</Text>
        {[2450000, 2400000, 2350000].map((price, i) => <View key={price} style={ui.stack}>
          <Text style={typography.footnote}>{["03/09", "08/09", "12/09"][i]} · {moneyLabel(price)}</Text>
          <View accessible={false} style={ui.row}><View style={{ height: 12, borderRadius: 6, flex: price, backgroundColor: colors.teal }} /><View style={{ flex: 2800000 - price }} /></View>
        </View>)}
      </View>}
      <Segments scroll value={filter} onChange={setFilter} items={[{ value: "all", label: "Tất cả" }, { value: "active", label: "Dự kiến theo dõi" }, { value: "paused", label: "Tạm dừng" }]} />
      <DraftCollection key={id} scope={id} feature="price-watch" title="yêu cầu giá vé" editable={data.plan.permissions.can_edit}
        initial={{ origin: "", destination: "", direction: "one", departure: dateKey(data.trip.start_at, data.trip.timezone), returnDate: dateKey(data.trip.end_at, data.trip.timezone), passengers: "1", cabin: "economy", threshold: "", status: "active" }}
        fields={[
          { key: "direction", label: "Hành trình", options: [{ value: "one", label: "Một chiều" }, { value: "round", label: "Khứ hồi" }] },
          { key: "origin", label: "Điểm đi", suggestions: ["TP. Hồ Chí Minh (SGN)", "Hà Nội (HAN)"] },
          { key: "destination", label: "Điểm đến", suggestions: ["Đà Nẵng (DAD)", "Phú Quốc (PQC)"] },
          { key: "departure", label: "Ngày khởi hành", placeholder: "YYYY-MM-DD" },
          { key: "returnDate", label: "Ngày quay về", placeholder: "YYYY-MM-DD", visible: row => row.direction === "round" },
          { key: "passengers", label: "Số hành khách (1–9)", numeric: true }, { key: "cabin", label: "Hạng ghế", options: cabins },
          { key: "threshold", label: "Ngưỡng giá (VND)", numeric: true },
        ]} validate={watchError} filter={row => filter === "all" || row.status === filter}
        toggle={{ key: "status", on: "active", off: "paused", onLabel: "Tạm dừng yêu cầu nháp", offLabel: "Tiếp tục yêu cầu nháp" }}
        render={row => <><Text style={typography.headline}>{row.origin} → {row.destination}</Text>
          <Text style={typography.footnote}>{row.direction === "round" ? "Khứ hồi" : "Một chiều"} · {row.departure}{row.direction === "round" ? " – " + row.returnDate : ""}</Text>
          <Text style={typography.footnote}>{row.passengers} hành khách · {cabins.find(c => c.value === row.cabin)?.label}</Text>
          <Text style={typography.body}>Ngưỡng: {moneyLabel(Number(row.threshold) || 0)}</Text>
          <Text style={typography.footnote}>Giá gần nhất: chưa có dữ liệu · Lịch sử giá: chưa có</Text>
          <Text style={typography.footnote}>{row.status === "paused" ? "Tạm dừng trong bản nháp" : "Chưa đăng ký với nhà cung cấp"}</Text></>} />
    </>}
  </Screen>;
}
