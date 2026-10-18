import { Text, View } from "react-native";

import { typography } from "@/shared/theme/tokens";
import { DesignIcon } from "@/shared/ui/design-icon";
import { EmptyState, Heading, Notice, ResourceFeedback, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";

export default function DressCodeScreen() {
  const resource = useTrip(); const { data } = resource;
  return <Screen title="Dress code" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}><Heading title="Diện cùng một tông" subtitle={data?.trip.name ?? "Phong cách của cả nhóm"} /><ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />{data && <>{data.plan.dress_codes.map(code => <View key={code.id} style={ui.card}><View style={ui.row}><DesignIcon name="shirt" size={44} /><View style={ui.flex}><Text style={typography.section}>{code.label}</Text><Text style={typography.footnote}>{code.scope_type === "TRIP" ? "Cả hành trình" : code.scope_type === "DAY" ? code.plan_date : data.plan.activities.find(a => a.id === code.activity_id)?.title ?? "Theo hoạt động"}</Text></View></View>{code.description && <Text style={typography.body}>{code.description}</Text>}</View>)}{!data.plan.dress_codes.length && <EmptyState title="Phong cách đang để ngỏ" message="Khi nhóm chọn trang phục cho hành trình, bạn sẽ xem được tại đây." icon="shirt" />}<Notice>Trang phục do nhóm chia sẻ · Kéo xuống để cập nhật.</Notice></>}</Screen>;
}
