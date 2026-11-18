import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { typography } from "@/shared/theme/tokens";
import { AppHeader } from "@/shared/ui/app-header";
import { Button } from "@/shared/ui/button";
import { ProfileAvatar } from "../components/profile-avatar";
import { Feedback } from "@/shared/ui/feedback";
import { IconButton, SectionLink, ui } from "@/shared/ui/journal";
import { layered } from "@/shared/ui/page-intro";
import { Screen } from "@/shared/ui/screen";
import { pendingInvitation } from "@/features/trips/pending-invitation";
import { unregisterPushDevice } from "@/features/notifications/push";
import { useApi } from "@/shared/api/use-api";
import { useSession } from "../session/session-provider";

export default function ProfileScreen() {
  const { profile, signOut } = useSession();
  const api = useApi();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      pendingInvitation.set(undefined);
      if (profile?.id) await unregisterPushDevice(api.notifications, profile.id);
      await signOut();
      router.replace("/");
    } catch {
      setError("Chưa xác nhận được đăng xuất. Kiểm tra kết nối rồi thử lại; phiên trên máy chủ có thể vẫn còn hiệu lực.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen header={<AppHeader title="Tài khoản" showGreeting={false} showAvatar={false} />} tab="account">
      <View style={layered.panel}><View style={ui.row}>
        <ProfileAvatar profile={profile} />
        <View style={ui.flex}>
          <Text style={typography.section}>{profile?.full_name}</Text>
          <Text style={[typography.footnote, { marginTop: 4 }]}>
            {profile?.email}
          </Text>
        </View>
        <IconButton
          icon="edit"
          label="Chỉnh sửa hồ sơ"
          onPress={() => router.push("/edit-profile")}
        />
      </View></View>
      <View style={[layered.tint, layered.rows]}>
        <SectionLink grouped title="Đổi mật khẩu" icon="lock" onPress={() => router.push("/change-password")} />
        {!profile?.email_verified_at && <SectionLink grouped title="Xác minh email" subtitle="Email chưa xác minh" icon="mail" onPress={() => router.push("/verify-email")} />}
        <SectionLink
          grouped
          title="Chuyến đi của tôi"
          icon="trip"
          onPress={() => router.navigate("/(tabs)/trips")}
        />
        <SectionLink
          grouped
          title="Lời mời chuyến đi"
          icon="mail"
          onPress={() => router.push("/invitation")}
        />
        <SectionLink
          grouped
          title="Thông báo"
          icon="bell"
          onPress={() => router.push("/notifications")}
        />
        <SectionLink
          grouped
          last
          title="Phiên đang đăng nhập"
          icon="lock"
          onPress={() => router.push("/sessions")}
        />
      </View>
      {error && <Feedback message={error} />}
      <Button
        label="Đăng xuất"
        variant="text"
        loading={busy}
        onPress={() => { void logout(); }}
      />
    </Screen>
  );
}
