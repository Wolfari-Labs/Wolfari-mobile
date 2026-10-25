import { useState } from "react";
import { Text } from "react-native";
import { useLocalDraft } from "@/shared/storage/use-local-draft";
import { typography } from "@/shared/theme/tokens";
import { Heading, Notice, ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { DraftCollection } from "../components/draft-collection";
import { useTrip } from "../hooks/use-trip";
import { isPlaceDraft } from "../model/place-draft";
import { dateKey, timeLabel, tripDays } from "../utils";

export default function PlanDraftScreen() {
  const resource = useTrip(), { data, id } = resource;
  const places = useLocalDraft(id, "places", isPlaceDraft);
  const [day, setDay] = useState("all");
  const days = data ? tripDays(data.trip) : [];
  const choices = [{ value: "", label: "Chưa xếp ngày" }, ...days.map((value, i) => ({ value, label: "Ngày " + (i + 1) + " · " + value }))];
  const selectedLocations = [
    ...(data?.plan.selected_locations ?? []).map(p => ({ id: p.id, name: p.name, address: p.address ?? "" })),
    ...(places.value?.places ?? []),
  ].filter(p => places.value?.selected.includes(p.id) && !places.value.hidden.includes(p.id));
  return <Screen title="Bản nháp lịch trình" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
    <Heading title="Thử xếp một hành trình" subtitle="Lịch trình chung và chức năng sắp xếp thật vẫn nằm ở tab Lịch trình." />
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {places.error && <Notice>{places.error}</Notice>}
    {data && <>
      <Notice>Đổi ngày, giờ và nội dung ở đây chỉ tạo phương án riêng. Không có nút đồng bộ tự động để tránh ghi đè lịch trình của nhóm.</Notice>
      {!!selectedLocations.length && <Text style={typography.footnote}>Địa điểm đã chọn trên bản đồ: {selectedLocations.map(p => p.name).join(" · ")}</Text>}
      <Segments scroll value={day} onChange={setDay} items={[{ value: "all", label: "Mọi ngày" }, ...choices]} />
      <DraftCollection key={id} scope={id} feature="plan" title="hoạt động nháp"
        editable={data.plan.permissions.can_edit}
        base={JSON.stringify([data.plan.plan_version, data.trip.start_at, data.trip.end_at, data.trip.timezone])}
        seed={data.plan.activities.map(a => ({ id: a.id, name: a.title, day: a.starts_at ? dateKey(a.starts_at, data.trip.timezone) : "", time: a.starts_at ? timeLabel(a.starts_at, data.trip.timezone) : "", note: a.description ?? "", location: a.selected_location_id ?? "" }))}
        initial={{ name: "", day: day !== "all" ? day : "", time: "", note: "", location: "" }}
        fields={[
          { key: "name", label: "Tên hoạt động nháp", suggestions: selectedLocations.map(p => p.name).slice(0, 10) },
          { key: "day", label: "Xếp vào ngày", options: choices },
          { key: "time", label: "Giờ dự kiến", placeholder: "HH:mm (không bắt buộc)", visible: row => !!row.day },
          { key: "location", label: "Địa điểm từ bản đồ (nháp)", options: [{ value: "", label: "Chưa chọn" }, ...selectedLocations.map(p => ({ value: p.id, label: p.name }))] },
          { key: "note", label: "Ghi chú lịch trình", multiline: true },
        ]}
        validate={row => !row.name?.trim() ? "Nhập tên hoạt động." : row.day && !days.includes(row.day) ? "Ngày nằm ngoài chuyến đi." : row.day && row.time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.time) ? "Giờ cần đúng định dạng HH:mm." : undefined}
        filter={row => day === "all" || row.day === day} groupBy="day"
        render={row => <><Text style={typography.headline}>{row.name}</Text><Text style={typography.footnote}>{row.day || "Chưa xếp ngày"}{row.day && row.time ? " · " + row.time : ""} · Bản nháp</Text>
          {!!row.location && <Text style={typography.footnote}>{selectedLocations.find(p => p.id === row.location)?.name ?? data.plan.selected_locations.find(p => p.id === row.location)?.name ?? "Địa điểm không còn được chọn"}</Text>}
          {!!row.note && <Text style={typography.body}>{row.note}</Text>}</>} />
    </>}
  </Screen>;
}
