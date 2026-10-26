import { useState } from "react";
import { Text } from "react-native";
import { typography } from "@/shared/theme/tokens";
import { Heading, ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { DraftCollection } from "../components/draft-collection";
import { tripDays } from "../utils";

export default function DressCodeScreen() {
  const resource = useTrip(), { data, id } = resource;
  const [scope, setScope] = useState("ALL");
  const days = data ? tripDays(data.trip) : [];
  return <Screen title="Dress code" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
    <Heading title="Diện cùng một tông" subtitle={data?.trip.name} />
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <>
      <Segments scroll value={scope} onChange={setScope} items={[{ value: "ALL", label: "Tất cả" }, { value: "TRIP", label: "Cả chuyến" }, { value: "DAY", label: "Theo ngày" }, { value: "ACTIVITY", label: "Hoạt động" }]} />
      <DraftCollection key={id} scope={id} feature="dress-code" title="dress code" editable={data.plan.permissions.can_edit}
        base={JSON.stringify([data.plan.dress_codes, days, data.plan.activities.map(a => a.id)])}
        seed={data.plan.dress_codes.map(code => ({ id: code.id, label: code.label, scope: code.scope_type, date: code.plan_date ?? "", activity: code.activity_id ?? "", description: code.description ?? "", palette: "" }))}
        initial={{ label: "", scope: "TRIP", date: days[0] ?? "", activity: data.plan.activities[0]?.id ?? "", description: "", palette: "" }}
        fields={[
          { key: "label", label: "Tên dress code" },
          { key: "scope", label: "Áp dụng", options: [{ value: "TRIP", label: "Cả chuyến" }, { value: "DAY", label: "Theo ngày" }, { value: "ACTIVITY", label: "Hoạt động" }] },
          { key: "date", label: "Ngày áp dụng", options: days.map(value => ({ value, label: value })), visible: row => row.scope === "DAY" },
          { key: "activity", label: "Hoạt động áp dụng", options: data.plan.activities.map(a => ({ value: a.id, label: a.title })), visible: row => row.scope === "ACTIVITY" },
          { key: "palette", label: "Tông màu gợi ý", suggestions: ["Trắng · Be", "Xanh biển · Trắng", "Nâu · Kem"] },
          { key: "description", label: "Mô tả trang phục", multiline: true },
        ]}
        validate={row => !row.label?.trim() ? "Nhập tên dress code." : row.scope === "DAY" && !days.includes(row.date) ? "Chọn ngày trong chuyến đi." : row.scope === "ACTIVITY" && !data.plan.activities.some(a => a.id === row.activity) ? "Chọn một hoạt động hiện có; thêm hoạt động trước nếu danh sách trống." : undefined}
        filter={row => scope === "ALL" || row.scope === scope}
        render={row => <><Text style={typography.section}>{row.label}</Text><Text style={typography.footnote}>{row.scope === "TRIP" ? "Cả hành trình" : row.scope === "DAY" ? row.date : data.plan.activities.find(a => a.id === row.activity)?.title ?? "Hoạt động không còn trong kế hoạch"}</Text>
          {!!row.palette && <Text style={typography.headline}>{row.palette}</Text>}{!!row.description && <Text style={typography.body}>{row.description}</Text>}</>}
      />
    </>}
  </Screen>;
}
