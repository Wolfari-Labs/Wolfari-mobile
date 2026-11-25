import { router } from "expo-router";
import { Text, View } from "react-native";

import { typography } from "@/shared/theme/tokens";
import { layered } from "@/shared/ui/page-intro";
import { Heading, Progress, ResourceFeedback, SectionLink, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { TripNavigation } from "../components/trip-navigation";
import { useTrip } from "../hooks/use-trip";

export default function TripToolsScreen() {
  const resource = useTrip(); const { data, id } = resource;
  const done = data?.plan.packing_items.filter(item => item.status === "COMPLETED").length ?? 0;
  const total = data?.plan.packing_items.length ?? 0;
  return <Screen title={data?.trip.name ?? "Tiện ích chuyến đi"} tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}><ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />{data && <><TripNavigation id={id} active="tools" /><Heading title="Tiện ích chuyến đi" />
    {total > 0 && (
      <View style={ui.section}>
        <Text style={typography.footnote}>HÀNH LÝ CỦA NHÓM</Text>
        <Text style={typography.largeTitle}>{done} / {total} món</Text>
        <Progress done={done} total={total} />
      </View>
    )}
    <View style={[layered.panel, layered.rows]}>
    <SectionLink grouped title="Hành lý" icon="bag" onPress={() => router.push({ pathname: "/trip/[id]/packing", params: { id } })} />
    <SectionLink grouped title="Dress code" icon="shirt" onPress={() => router.push({ pathname: "/trip/[id]/dress-code", params: { id } })} />
    <SectionLink grouped title="Quỹ nhóm" icon="wallet" onPress={() => router.push({ pathname: "/trip/[id]/fund", params: { id } })} />
    <SectionLink grouped title="Thành viên" icon="users" onPress={() => router.push({ pathname: "/trip/[id]/members", params: { id } })} />
    <SectionLink grouped title="Theo dõi giá vé" subtitle="Theo dõi chặng bay và đặt ngưỡng báo giá" icon="plane" onPress={() => router.push({ pathname: "/trip/[id]/price-watch", params: { id } })} />
    <SectionLink grouped title="Lịch nhắc của tôi" icon="calendar" onPress={() => router.push({ pathname: "/trip/[id]/reminders", params: { id } })} />
    <SectionLink grouped title="Xuất kế hoạch PDF" icon="calendar" onPress={() => router.push({ pathname: "/trip/[id]/export", params: { id } })} />
    <SectionLink grouped last title="Cài đặt chuyến đi" icon="gear" onPress={() => router.push({ pathname: "/trip/[id]/settings", params: { id } })} />
    </View>
  </>}</Screen>;
}
