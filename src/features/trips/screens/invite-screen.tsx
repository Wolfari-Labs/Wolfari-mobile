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
import { EmptyState, Heading, Notice, ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import type { InvitationResult } from "../types";
import { dateLabel } from "../utils";

export default function InviteScreen() {
  const resource = useTrip();
  const { data, api, id } = resource;
  const command = useCommand();
  const [kind, setKind] = useState<"EMAIL" | "LINK">("EMAIL");
  const [email, setEmail] = useState("");
  const [validation, setValidation] = useState<string>();
  const [result, setResult] = useState<InvitationResult>();
  async function submit() {
    if (!data || data.trip.current_membership.role !== "OWNER") return;
    if (kind === "EMAIL" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 255)) { setValidation("Vui lòng nhập địa chỉ email hợp lệ."); return; }
    setValidation(undefined);
    const response = await command.run({ kind, email: kind === "EMAIL" ? email.trim().toLowerCase() : undefined, revision: data.trip.membership_revision }, key => kind === "EMAIL" ? api.trips.invite(data.trip, email, key) : api.trips.inviteLink(data.trip, key));
    if (response) setResult(response);
  }
  const allowed = data?.trip.current_membership.role === "OWNER";
  return <Screen title="Mời thành viên" bottomPadding={24} footer={allowed && !result ? <Button label={kind === "EMAIL" ? "Gửi lời mời" : "Tạo liên kết mời"} loading={command.busy} onPress={() => { void submit(); }} /> : undefined}>
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && (allowed ? <>
      <Heading title={"Đi cùng nhau,\nvui hơn nhiều!"} aside={<Image source={designAssets.mascot} style={{ width: 84, height: 84 }} contentFit="contain" />} subtitle={"Mời bạn bè tham gia " + data.trip.name + "."} />
      {result ? <>
        <Feedback success message={(result.invitation.email ? "Lời mời cho " + result.invitation.email : "Lời mời bằng liên kết") + " đã được tạo. Hết hạn " + dateLabel(result.invitation.expires_at) + "."} />
        {result.one_time_link ? <View style={{ gap: 8 }}>
          <Text style={typography.footnote}>Nhấn giữ để sao chép liên kết. Chỉ chia sẻ với người bạn muốn mời; liên kết chỉ nhận được một lần.</Text>
          <Text selectable style={typography.body}>{result.one_time_link}</Text>
        </View> : result.invitation.invitation_type === "LINK" && <Notice>Máy chủ không trả lại liên kết bí mật ở lần thử này. Bạn có thể thu hồi lời mời trong Thành viên trước khi tạo lời mời khác.</Notice>}
        <Button label="Xem bạn đồng hành" onPress={() => router.replace({ pathname: "/trip/[id]/members", params: { id } })} />
        <Button label="Mời thêm một người bạn" variant="soft" onPress={() => { setResult(undefined); setEmail(""); }} />
      </> : <>
        <Segments items={[{ value: "EMAIL", label: "Qua email" }, { value: "LINK", label: "Bằng liên kết" }]} value={kind} onChange={value => { if (!command.busy) { setKind(value); setValidation(undefined); } }} />
        {validation && <Feedback message={validation} />}
        {command.error && <><Feedback message={command.error} /><Button label="Cập nhật thông tin nhóm" variant="soft" compact onPress={() => { void resource.reload(); }} /></>}
        {kind === "EMAIL" ? <FormField label="Email người được mời" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="banbe@email.com" editable={!command.busy} /> : <Notice>Người có liên kết hợp lệ và đáp ứng điều kiện tài khoản của hệ thống có thể nhận lời mời. Không đăng liên kết công khai.</Notice>}
        <Text style={typography.footnote}>Người nhận cần đăng nhập để phản hồi. Bạn có thể thu hồi lời mời trong danh sách thành viên.</Text>
      </>}
    </> : <EmptyState title="Cùng mời bạn bè" message="Người tổ chức chuyến đi có quyền gửi lời mời cho nhóm." icon="users" />)}
  </Screen>;
}
