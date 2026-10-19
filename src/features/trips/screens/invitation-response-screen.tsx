import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { Heading } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { pendingInvitation } from "../pending-invitation";
import type { InvitationPreview } from "../types";
import { dateLabel, invitationToken } from "../utils";

export default function InvitationResponseScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const api = useApi(); const { status } = useSession(); const command = useCommand();
  const [input, setInput] = useState(params.token ?? pendingInvitation.get() ?? "");
  const [preview, setPreview] = useState<InvitationPreview>(); const [validation, setValidation] = useState<string>(); const [resolved, setResolved] = useState(false);
  const [reviewedToken, setReviewedToken] = useState<string>();
  const [reviewedAt, setReviewedAt] = useState(0);
  async function inspect() {
    const token = invitationToken(input);
    if (!token) { setValidation("Dán liên kết lời mời hoặc mã bắt đầu bằng inv1_ hợp lệ."); return; }
    setValidation(undefined); pendingInvitation.set(token);
    const result = await command.run({ preview: token }, () => api.trips.previewInvitation(token));
    if (result) { setPreview(result); setReviewedToken(token); setReviewedAt(Date.now()); }
  }
  async function respond(action: "accept" | "decline") {
    if (!reviewedToken || !preview) return;
    const result = await command.run({ action, token: reviewedToken }, key => api.trips.respondInvitation(reviewedToken, action, key));
    if (result) {
      pendingInvitation.set(undefined); setResolved(true);
      if (action === "accept" && result.membership) router.replace({ pathname: "/trip/[id]", params: { id: result.membership.trip_id } });
    }
  }
  return <Screen title="Lời mời chuyến đi" bottomPadding={32}><Heading title="Đi cùng nhau,\nvui hơn nhiều!" subtitle="Mở lời mời từ những người bạn đồng hành." />
    {validation && <Feedback message={validation} />}{command.error && <Feedback message={command.error} />}
    {resolved ? <><Feedback success message="Đã phản hồi lời mời." /><Button label="Về chuyến đi của tôi" onPress={() => router.replace("/(tabs)/trips")} /></> : <>
      <FormField label="Liên kết hoặc mã lời mời" icon="mail" value={input} onChangeText={value => { setInput(value); setPreview(undefined); }} autoCapitalize="none" autoCorrect={false} placeholder="Dán lời mời bạn nhận được…" editable={!command.busy} />
      {status !== "authenticated" ? <><Text style={typography.body}>Đăng nhập để xem và phản hồi lời mời.</Text><Button label="Đăng nhập" onPress={() => { const token = invitationToken(input); if (token) pendingInvitation.set(token); router.push("/sign-in"); }} /></> : <Button label="Xem lời mời" loading={command.busy} variant="soft" onPress={() => { void inspect(); }} />}
      {preview && <><Image source={designAssets.coast} style={{ width: "100%", height: 180, borderRadius: 24 }} contentFit="cover" /><Heading title={preview.trip_name} subtitle={`${preview.inviter_display_name} đã mời bạn`} /><View style={{ gap: 8 }}><Text style={typography.body}>Tham gia với vai trò thành viên</Text><Text style={typography.footnote}>Hết hạn {dateLabel(preview.expires_at)}</Text></View>{preview.status === "PENDING" && Date.parse(preview.expires_at) > reviewedAt ? <><Button label="Chấp nhận lời mời" loading={command.busy} onPress={() => { void respond("accept"); }} /><Button label="Từ chối" disabled={command.busy} variant="soft" onPress={() => { void respond("decline"); }} /></> : <Feedback message="Lời mời này đã được phản hồi hoặc không còn hiệu lực." />}</>}
    </>}
  </Screen>;
}
