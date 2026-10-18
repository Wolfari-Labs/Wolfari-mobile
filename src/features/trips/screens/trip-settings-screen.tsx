import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Heading, ResourceFeedback, SectionLink, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { coverFor } from "../components/trip-card";
import { useTrip } from "../hooks/use-trip";
import type { PlanPolicy } from "../types";
import { tripDates } from "../utils";

const policyLabels: Record<PlanPolicy, string> = { OWNER_ONLY: "Chỉ người tổ chức", ALL_MEMBERS: "Tất cả thành viên", SELECTED_MEMBERS: "Các thành viên được chọn" };
export default function TripSettingsScreen() {
  const resource = useTrip(); const { data, api, id } = resource; const command = useCommand();
  const [choice, setChoice] = useState<"OWNER_ONLY" | "ALL_MEMBERS">(); const [success, setSuccess] = useState(false);
  async function save() {
    if (!data || !choice) return;
    const result = await command.run({ policy: choice, revision: data.trip.membership_revision }, key => api.trips.policy(data.trip, choice, [], key));
    if (result) { setChoice(undefined); setSuccess(true); await resource.reload(); }
  }
  const owner = data?.trip.current_membership.role === "OWNER";
  return <Screen title="Cài đặt chuyến đi" tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}><Heading title="Một chuyến đi,\ncùng một nhịp" /><ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <><View style={[ui.row, { marginVertical: 12 }]}><Image source={coverFor(data.trip)} style={{ width: 76, height: 76, borderRadius: 20 }} contentFit="cover" /><View style={ui.flex}><Text style={typography.headline}>{data.trip.name}</Text><Text style={typography.footnote}>{tripDates(data.trip)}</Text></View></View>
      {data.trip.permissions.can_update && <Button label="Chỉnh sửa thông tin" variant="soft" onPress={() => router.push({ pathname: "/trip/[id]/edit", params: { id } })} />}
      <Text accessibilityRole="header" style={[typography.section, { marginTop: 24 }]}>Quyền trong nhóm</Text><Text style={typography.body}>Ai có thể chỉnh sửa lịch trình?</Text><Text style={typography.footnote}>Hiện tại: {policyLabels[data.trip.plan_edit_policy]}</Text>
      {owner ? <><Segments items={[{ value: "OWNER_ONLY", label: "Chỉ chủ nhóm" }, { value: "ALL_MEMBERS", label: "Cả nhóm" }]} value={choice ?? data.trip.plan_edit_policy} onChange={value => { setChoice(value as "OWNER_ONLY" | "ALL_MEMBERS"); setSuccess(false); }} />{data.trip.plan_edit_policy === "SELECTED_MEMBERS" && <Text style={typography.footnote}>Nhóm đang giới hạn cho các thành viên đã được chọn. Chọn một chế độ phía trên nếu bạn muốn đổi quyền cho cả nhóm.</Text>}{command.error && <><Feedback message={command.error} /><Button label="Tải thông tin mới nhất" variant="soft" compact onPress={() => { void resource.reload(); }} /></>}{success && <Feedback success message="Đã cập nhật quyền chỉnh sửa của nhóm." />}<Button label="Lưu quyền của nhóm" loading={command.busy} disabled={!choice} onPress={() => { void save(); }} /></> : <Text style={typography.footnote}>Người tổ chức quản lý quyền sửa kế hoạch của các thành viên.</Text>}
      <SectionLink title="Bạn đồng hành" subtitle="Thành viên và lời mời" icon="users" onPress={() => router.push({ pathname: "/trip/[id]/members", params: { id } })} />
    </>}
  </Screen>;
}
