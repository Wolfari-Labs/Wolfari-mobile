import { useCallback } from "react";
import { useResource } from "@/shared/hooks/use-resource";
import { ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { PackingList } from "../components/packing-list";
import { collectPages } from "../api/pagination";

export default function PackingScreen() {
  const resource = useTrip(), { data, id, api } = resource;
  const members = useResource(useCallback((signal: AbortSignal) => collectPages(cursor => api.trips.members(id, cursor, signal), signal), [api, id]));
  return <Screen title="Hành lý" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <>
      <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />
      <PackingList api={api} trip={data.trip} plan={data.plan} members={members.data ?? []} membersReady={!!members.data && !members.loading && !members.error} reload={resource.reload} />
    </>}
  </Screen>;
}
