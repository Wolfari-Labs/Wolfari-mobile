import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { colors, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { ClayAvatar } from "@/shared/ui/clay-form";
import { ClayButton, ClayIcon } from "@/shared/ui/setting-card";
import { coverFor } from "../components/trip-card";
import { Screen } from "@/shared/ui/screen";
import { toast } from "@/shared/ui/toast";
import { pendingInvitation } from "../pending-invitation";
import type { InvitationPreview } from "../types";
import { dateLabel, invitationToken } from "../utils";

export default function InvitationResponseScreen() {
  const params = useLocalSearchParams<{ token?: string; code?: string }>();
  // A scanned invitation QR opens …/invitation?code=XXXX-XXXX; older links use ?token=.
  const linked = params.code ?? params.token;
  const { profile } = useSession();
  return <Invitation key={`${profile?.id ?? "guest"}:${linked ?? ""}`} linked={linked} />;
}

function Invitation({ linked }: { linked?: string }) {
  const api = useApi(); const { status } = useSession(); const command = useCommand();
  const [restored, setRestored] = useState(pendingInvitation.get);
  const [input, setInput] = useState(linked ?? restored ?? "");
  const [preview, setPreview] = useState<InvitationPreview>(); const [validation, setValidation] = useState<string>(); const [resolved, setResolved] = useState(false);
  const [reviewedToken, setReviewedToken] = useState<string>();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!preview || preview.status !== "PENDING") return;
    const timer = setInterval(() => setExpired(!(Date.parse(preview.expires_at) > Date.now())), 1000);
    return () => clearInterval(timer);
  }, [preview]);
  async function inspect(value = input) {
    const token = invitationToken(value);
    if (!token) { setValidation("Nhập mã mời gồm 8 ký tự, ví dụ K7PQ-4M2X."); return; }
    setValidation(undefined); pendingInvitation.set(token);
    const result = await command.run({ preview: token }, () => api.trips.previewInvitation(token));
    if (result) { setPreview(result); setReviewedToken(token); setExpired(!(Date.parse(result.expires_at) > Date.now())); }
  }
  async function paste() {
    const text = await Clipboard.getStringAsync().catch(() => "");
    const token = invitationToken(text);
    if (!token) { setValidation("Bộ nhớ tạm chưa có mã mời (dạng XXXX-XXXX)."); return; }
    setInput(token); setPreview(undefined); setValidation(undefined);
    if (status === "authenticated") await inspect(token);
  }
  // A code saved before sign-up/sign-in (kept 15 minutes) fills the field after an app restart.
  useEffect(() => {
    let active = true;
    void pendingInvitation.restore().then(saved => { if (active && saved) { setRestored(saved); setInput(current => current || saved); } });
    return () => { active = false; };
  }, []);
  // A shared app link (…/invitation?token=…) opens straight to the trip preview once signed in.
  const latestInspect = useRef(inspect);
  useEffect(() => { latestInspect.current = inspect; });
  const autoOpened = useRef(false);
  useEffect(() => {
    // After sign-in the app returns here without the query; the link's token waits in memory.
    const token = linked ?? restored;
    if (autoOpened.current || status !== "authenticated" || !token || !invitationToken(token)) return;
    autoOpened.current = true;
    void latestInspect.current(token);
  }, [status, linked, restored]);
  async function respond(action: "accept" | "decline") {
    if (!reviewedToken || !preview || preview.status !== "PENDING" || !(Date.parse(preview.expires_at) > Date.now())) { setExpired(true); return; }
    const result = await command.run({ action, token: reviewedToken }, key => api.trips.respondInvitation(reviewedToken, action, key));
    if (result) {
      pendingInvitation.set(undefined); setResolved(true);
      if (action === "accept" && result.membership) {
        toast.celebrate("Lịch trình, hành lý và quỹ chung của nhóm đã mở cho bạn.", { title: `Chào mừng tới ${preview.trip_name}` });
        router.replace({ pathname: "/trip/[id]", params: { id: result.membership.trip_id } });
      }
    }
  }
  return <Screen clay title="Lời mời chuyến đi" bottomPadding={32}>
    <Text accessibilityRole="header" style={typography.largeTitle}>{preview && !resolved ? "Cùng nhau lên đường nhé!" : "Đi cùng nhau, vui hơn nhiều!"}</Text>
    {validation && <Feedback message={validation} />}{command.error && <Feedback message={command.error} />}
    {resolved ? <><Feedback success message="Đã phản hồi lời mời." /><ClayButton label="Về chuyến đi của tôi" onPress={() => router.dismissTo("/(tabs)/trips")} /></> : !preview ? <>
      <FormField label="Mã mời" icon="mail" value={input} onChangeText={value => { setInput(value); setPreview(undefined); }} autoCapitalize="characters" autoCorrect={false} placeholder="VD: K7PQ-4M2X" editable={!command.busy} />
      <Text style={typography.footnote}>Nhập mã 8 ký tự người tổ chức gửi bạn, hoặc dán cả tin nhắn mời.</Text>
      <Button label="Dán từ bộ nhớ tạm" variant="soft" compact disabled={command.busy} style={{ alignSelf: "flex-start" }} onPress={() => { void paste(); }} />
      {status !== "authenticated" ? <><Text style={typography.body}>Đăng nhập để xem và phản hồi lời mời.</Text><Button label="Đăng nhập" onPress={() => { const token = invitationToken(input); if (token) pendingInvitation.set(token); router.push("/sign-in"); }} /></> : <Button label="Xem lời mời" loading={command.busy} variant="soft" onPress={() => { void inspect(); }} />}
    </> : <>
      <View style={styles.card}><View style={styles.hero}>
        <Image source={coverFor({ name: preview.trip_name })} style={styles.cover} contentFit="cover" accessible={false} />
        <Image source={designAssets.tripWave} style={styles.mascot} contentFit="contain" accessible={false} />
      </View><View style={styles.body}>
        <View style={styles.row}><ClayAvatar name={preview.inviter_display_name} index={0} /><View style={{ flex: 1 }}>
          <Text style={typography.headline}>{preview.inviter_display_name} đã mời bạn</Text>
          <Text style={typography.footnote}>Tham gia với vai trò thành viên</Text></View></View>
        <Text accessibilityRole="header" style={typography.title}>{preview.trip_name}</Text>
        <View style={styles.row}><ClayIcon name="fieldCalendar" size={20} /><Text style={typography.body}>Hết hạn {dateLabel(preview.expires_at)}</Text></View>
      </View></View>
      {preview.status === "PENDING" && !expired ? <View style={{ gap: 10 }}>
        <ClayButton label="Chấp nhận lời mời" icon="arrowRight" loading={command.busy} onPress={() => { void respond("accept"); }} />
        <ClayButton label="Từ chối" tone="secondary" disabled={command.busy} onPress={() => { void respond("decline"); }} />
        <Text style={[typography.footnote, { textAlign: "center" }]}>Bạn có thể thay đổi tùy chọn thông báo sau khi tham gia chuyến đi.</Text>
      </View> : <Feedback message="Lời mời này đã được phản hồi hoặc không còn hiệu lực." />}
      <Button label="Nhập mã mời khác" variant="text" disabled={command.busy} onPress={() => {
        pendingInvitation.set(undefined); setReviewedToken(undefined); setPreview(undefined); setValidation(undefined); setInput(""); command.clearError();
      }} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  card: { padding: 10, borderRadius: 30, backgroundColor: colors.surface, ...shadows.card },
  hero: { height: 158, position: "relative" },
  cover: { width: "100%", height: "100%", borderRadius: 22 },
  mascot: { position: "absolute", right: -9, top: -25, width: 104, height: 100 },
  body: { gap: 16, paddingHorizontal: 10, paddingTop: 20, paddingBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
