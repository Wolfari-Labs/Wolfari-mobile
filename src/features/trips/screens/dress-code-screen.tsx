import { router } from "expo-router";
import { Notice, ResourceFeedback } from "@/shared/ui/journal";
import { SettingCard } from "@/shared/ui/setting-card";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { DressCodeList } from "../components/dress-code-list";
import { tripDays } from "../utils";

export default function DressCodeScreen() {
  const resource = useTrip(), { data, id } = resource;
  const days = data ? tripDays(data.trip) : [];
  return <Screen title="Dress code" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && (data.plan.capabilities?.dress_codes_write
      ? <><SettingCard icon="sparkle" tone="lilac" title="Gợi ý trang phục" subtitle="Theo điểm đến (chùa, biển…) và nắng mưa từng ngày."
          onPress={() => router.push({ pathname: "/trip/[id]/suggestions", params: { id, type: "DRESS_CODE" } })} />
        <DressCodeList key={id} api={resource.api} trip={data.trip} plan={data.plan} days={days} reload={resource.reload} /></>
      : <Notice>Máy chủ này chưa hỗ trợ dress code dùng chung cho nhóm. Hãy cập nhật hệ thống rồi thử lại.</Notice>)}
  </Screen>;
}
