import { useState } from "react";
import { Heading, Notice, ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { DressCodeList } from "../components/dress-code-list";
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
      {data.plan.capabilities?.dress_codes_write
        ? <DressCodeList key={id} api={resource.api} trip={data.trip} plan={data.plan} days={days} scope={scope} reload={resource.reload} />
        : <Notice>Máy chủ này chưa hỗ trợ dress code dùng chung cho nhóm. Hãy cập nhật hệ thống rồi thử lại.</Notice>}
    </>}
  </Screen>;
}
