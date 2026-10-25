import { router } from "expo-router";
import { Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { Heading, Progress, ResourceFeedback, SectionLink, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { TripNavigation } from "../components/trip-navigation";
import { useTrip } from "../hooks/use-trip";

export default function TripToolsScreen() {
  const resource = useTrip(); const { data, id } = resource;
  const done = data?.plan.packing_items.filter(item => item.status === "COMPLETED").length ?? 0;
  return <Screen title={data?.trip.name ?? "Tiện ích chuyến đi"} tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}><ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />{data && <><TripNavigation id={id} active="tools" /><Heading title="Chuẩn bị cùng nhau" subtitle="Một nhóm, một chuyến đi đáng nhớ." />
    <View style={[ui.card, { backgroundColor: colors.mint }]}><Text style={typography.footnote}>HÀNH LÝ CỦA NHÓM</Text><Text style={typography.largeTitle}>{done} / {data.plan.packing_items.length} món</Text><Progress done={done} total={data.plan.packing_items.length} /></View>
    <SectionLink title="Hành lý" subtitle="Danh sách chuẩn bị của cả nhóm" icon="bag" onPress={() => router.push({ pathname: "/trip/[id]/packing", params: { id } })} />
    <SectionLink title="Dress code" subtitle="Tông màu cho những bức ảnh đẹp" icon="shirt" onPress={() => router.push({ pathname: "/trip/[id]/dress-code", params: { id } })} />
    <SectionLink title="Thành viên" subtitle="Những người bạn đồng hành" icon="users" onPress={() => router.push({ pathname: "/trip/[id]/members", params: { id } })} />
    <SectionLink title="Cài đặt chuyến đi" subtitle="Thông tin và quyền trong nhóm" icon="gear" onPress={() => router.push({ pathname: "/trip/[id]/settings", params: { id } })} />
    <SectionLink title="Quỹ nhóm" subtitle="Dự trù thu chi · Chưa kết nối quỹ thật" icon="wallet" onPress={() => router.push({ pathname: "/trip/[id]/fund", params: { id } })} />
    <SectionLink title="Theo dõi giá vé" subtitle="Soạn yêu cầu giá vé · Chưa kết nối giá trực tiếp" icon="plane" onPress={() => router.push({ pathname: "/trip/[id]/price-watch", params: { id } })} />
    <SectionLink title="Bản nháp lịch trình" subtitle="Thử xếp ngày riêng, không đổi kế hoạch chung" icon="calendar" onPress={() => router.push({ pathname: "/trip/[id]/plan-draft", params: { id } })} />
  </>}</Screen>;
}
