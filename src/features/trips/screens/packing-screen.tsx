import { useCallback, useState } from "react";
import { useResource } from "@/shared/hooks/use-resource";
import { ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { PackingList } from "../components/packing-list";
import { collectPages } from "../api/pagination";

export default function PackingScreen() {
  const resource = useTrip(), { data, id, api } = resource;
  const members = useResource(useCallback((signal: AbortSignal) => collectPages(cursor => api.trips.members(id, cursor, signal), signal), [api, id]));
  const [filter, setFilter] = useState<"all" | "mine" | "todo">("all");
  const [category, setCategory] = useState("all");
  return <Screen title="Hành lý" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <>
      <Segments items={[{ value: "all", label: "Tất cả" }, { value: "mine", label: "Của tôi" }, { value: "todo", label: "Chưa xong" }]} value={filter} onChange={setFilter} />
      {/* Only categories that actually hold items; an empty list needs no category filter. */}
      {data.plan.packing_items.length > 0 && <Segments scroll value={category} onChange={setCategory} items={[{ value: "all", label: "Mọi danh mục" }, ...[...new Set(data.plan.packing_items.map(p => p.category || "Khác"))].map(value => ({ value, label: value }))]} />}
      <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />
      <PackingList api={api} trip={data.trip} plan={data.plan} members={members.data ?? []} membersReady={!!members.data && !members.loading && !members.error} reload={resource.reload} filter={filter} category={category} />
    </>}
  </Screen>;
}
