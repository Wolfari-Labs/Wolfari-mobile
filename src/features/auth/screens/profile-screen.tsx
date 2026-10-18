import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { AppHeader } from "@/shared/ui/app-header";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { Heading, IconButton, SectionLink, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { pendingInvitation } from "@/features/trips/pending-invitation";
import { useSession } from "../session/session-provider";

export default function ProfileScreen() {
  const { profile, signOut } = useSession();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      pendingInvitation.set(undefined);
      await signOut();
      router.replace("/");
    } catch {
      setError("Chưa thể xóa phiên trên thiết bị. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen header={<AppHeader />} tab="account">
      <Heading
        large
        title="Tài khoản"
        subtitle="Những hành trình bắt đầu từ đây."
      />
      <View style={[ui.card, ui.row]}>
        <Image
          source={designAssets.profileMascot}
          style={{ width: 64, height: 64 }}
          contentFit="contain"
        />
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
      </View>
      <View style={ui.group}>
        <SectionLink
          grouped
          title="Chuyến đi của tôi"
          subtitle="Hẹn những ngày thật đẹp"
          icon="trip"
          onPress={() => router.navigate("/(tabs)/trips")}
        />
        <SectionLink
          grouped
          title="Lời mời chuyến đi"
          subtitle="Tham gia hành trình cùng bạn bè"
          icon="mail"
          onPress={() => router.push("/invitation")}
        />
        <SectionLink
          grouped
          last
          title="Phiên đang đăng nhập"
          subtitle="Xem và thu hồi quyền truy cập tài khoản"
          icon="lock"
          onPress={() => router.push("/sessions")}
        />
      </View>
      <Text
        style={[
          typography.footnote,
          { color: colors.muted, paddingHorizontal: 4 },
        ]}
      >
        Cùng Wolfari lưu giữ những hành trình đáng nhớ.
      </Text>
      <Button
        label="Đăng xuất"
        variant="destructive"
        onPress={() => {
          setError(undefined);
          setConfirm(true);
        }}
      />
      <Sheet
        visible={confirm}
        dismissible={!busy}
        title="Đăng xuất khỏi Wolfari?"
        onClose={() => setConfirm(false)}
      >
        <Text style={typography.body}>
          Phiên đã lưu trên thiết bị này sẽ được xóa. Bạn có thể đăng nhập lại
          bất cứ lúc nào.
        </Text>
        {error && <Feedback message={error} />}
        <Button
          label="Đăng xuất tài khoản"
          variant="destructive"
          loading={busy}
          onPress={() => {
            void logout();
          }}
        />
      </Sheet>
    </Screen>
  );
}
