import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Heading, ResourceFeedback, SectionLink } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import type { InvitationResult } from "../types";
import { dateLabel } from "../utils";

export default function InviteScreen() {
  const resource = useTrip(); const { data, api, id } = resource; const command = useCommand();
  const [email, setEmail] = useState(""); const [validation, setValidation] = useState<string>(); const [result, setResult] = useState<InvitationResult>();
  async function submit() {
    if (!data) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 255) { setValidation("Vui lòng nhập địa chỉ email hợp lệ."); return; }
    setValidation(undefined);
    const response = await command.run({ email: email.trim().toLowerCase(), revision: data.trip.membership_revision }, key => api.trips.invite(data.trip, email, key));
    if (response) setResult(response);
  }
  const allowed = data?.trip.current_membership.role === "OWNER";
  return <Screen title="Mời thành viên" bottomPadding={24} footer={allowed && !result ? <Button label="Gửi lời mời" loading={command.busy} onPress={() => { void submit(); }} /> : undefined}>
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && (allowed ? <><Heading title="Đi cùng nhau,\nvui hơn nhiều!" aside={<Image source={designAssets.mascot} style={{ width: 84, height: 84 }} contentFit="contain" />} subtitle={`Mời bạn bè tham gia ${data.trip.name}.`} />
      {result ? <><Feedback success message={`Lời mời cho ${result.invitation.email} đã được tạo. Hết hạn ${dateLabel(result.invitation.expires_at)}.`} />{result.one_time_link && <View style={{ gap: 8 }}><Text style={typography.footnote}>Liên kết mời dùng thử</Text><Text selectable style={typography.body}>{result.one_time_link}</Text></View>}<Button label="Xem bạn đồng hành" onPress={() => router.replace({ pathname: "/trip/[id]/members", params: { id } })} /><Button label="Mời thêm một người bạn" variant="soft" onPress={() => { setResult(undefined); setEmail(""); }} /></> : <>{validation && <Feedback message={validation} />}{command.error && <><Feedback message={command.error} /><Button label="Cập nhật thông tin nhóm" variant="soft" compact onPress={() => { void resource.reload(); }} /></>}<FormField label="Email người được mời" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="banbe@email.com" editable={!command.busy} /><SectionLink title="Thành viên" subtitle="Quyền sửa kế hoạch theo cài đặt của nhóm" icon="users" /><Text style={typography.footnote}>Người được mời cần đăng nhập đúng tài khoản để phản hồi lời mời.</Text></>}
    </> : <EmptyState title="Cùng mời bạn bè" message="Người tổ chức chuyến đi có quyền gửi lời mời cho nhóm." icon="users" />)}
  </Screen>;
}
