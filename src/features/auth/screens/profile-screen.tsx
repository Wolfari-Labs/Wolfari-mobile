import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { collectPages } from "@/features/trips/api/pagination";
import { pendingInvitation } from "@/features/trips/pending-invitation";
import { unregisterPushDevice } from "@/features/notifications/push";
import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { AppHeader } from "@/shared/ui/app-header";
import { Button } from "@/shared/ui/button";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { Screen } from "@/shared/ui/screen";
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings-list";
import { Sheet } from "@/shared/ui/sheet";
import { ProfileAvatar } from "../components/profile-avatar";
import { useSession } from "../session/session-provider";

/**
 * The Account tab is about the person, not their trips (the Trips tab already lists them):
 * identity, inbox and invitations, security and app info. Trip numbers appear only as a
 * small "travel passport" summary that links to the Trips tab.
 */
export default function ProfileScreen() {
  const { profile, signOut } = useSession();
  const api = useApi();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const trips = useResource(useCallback((signal: AbortSignal) => api.trips.list(undefined, undefined, signal), [api]), !!profile);
  const unread = useResource(useCallback(async (signal: AbortSignal) => {
    const page = await api.notifications.list({ unread: true, limit: 50, signal });
    return page.items.filter((item) => item.status !== "CANCELLED" && !item.read_at).length;
  }, [api]), !!profile);
  const sessions = useResource(useCallback((signal: AbortSignal) => collectPages<{ id: string }>(
    (cursor) => api.request(`/me/sessions?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal }), signal,
  ), [api]), !!profile);
  const items = trips.data?.items ?? [];
  const count = (lifecycle: string) => items.filter((trip) => trip.lifecycle === lifecycle).length;
  const more = trips.data?.next_cursor ? "+" : "";

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      pendingInvitation.set(undefined);
      if (profile?.id) await unregisterPushDevice(api.notifications, profile.id);
      await signOut();
      setConfirm(false);
      router.replace("/");
    } catch {
      setError("Chưa xác nhận được đăng xuất. Kiểm tra kết nối rồi thử lại; phiên trên máy chủ có thể vẫn còn hiệu lực.");
    } finally {
      setBusy(false);
    }
  }
  const refresh = () => { void Promise.all([trips.reload(), unread.reload(), sessions.reload()]); };
  const verified = !!profile?.email_verified_at;
  return (
    <Screen header={<AppHeader title="Tài khoản" showGreeting={false} showAvatar={false} />} tab="account" onRefresh={refresh} refreshing={(trips.loading || unread.loading) && !!trips.data}>
      <View style={styles.hero}>
        <LinearGradient colors={["#DCE9FF", "#E9E1FF", "#D6F5E8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.heroTop}>
          <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Đổi ảnh đại diện và thông tin cá nhân" onPress={() => router.push("/edit-profile")} style={styles.avatarRing}>
            <ProfileAvatar profile={profile} size={76} />
            <View style={styles.avatarEdit}><DesignIcon name="edit" size={13} tintColor={colors.surface} /></View>
          </Pressable>
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={2}>{profile?.full_name}</Text>
            <Text style={typography.footnote} numberOfLines={1}>{profile?.email}</Text>
            <Pressable cssInterop={false} accessibilityRole={verified ? "text" : "button"} disabled={verified} onPress={() => router.push("/verify-email")}
              style={[styles.chip, verified ? styles.chipOk : styles.chipWarn]}>
              <Text style={[styles.chipText, { color: verified ? colors.pinGreen : colors.amber }]}>{verified ? "✓ Email đã xác minh" : "! Chưa xác minh email"}</Text>
            </Pressable>
          </View>
        </View>
        <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Xem chuyến đi của tôi" onPress={() => router.navigate("/(tabs)/trips")} style={({ pressed }) => [styles.passport, pressed && { opacity: 0.8 }]}>
          <Stat value={`${count("ONGOING") + count("UPCOMING")}${more}`} label="Sắp tới" />
          <View style={styles.divider} />
          <Stat value={`${count("COMPLETED")}${more}`} label="Đã đi" />
          <View style={styles.divider} />
          <Stat value={`${items.length}${more}`} label="Hành trình" />
        </Pressable>
      </View>

      <SettingsGroup title="Hồ sơ">
        <SettingsRow icon="user" tone="blue" title="Thông tin cá nhân" subtitle="Tên hiển thị và ảnh đại diện" onPress={() => router.push("/edit-profile")} />
        {!verified && <SettingsRow icon="mail" tone="butter" title="Xác minh email" subtitle="Cần để nhận lời mời và khôi phục mật khẩu" onPress={() => router.push("/verify-email")} />}
        <SettingsRow last icon="lock" tone="lilac" title="Đổi mật khẩu" onPress={() => router.push("/change-password")} />
      </SettingsGroup>

      <SettingsGroup title="Thông báo & lời mời">
        <SettingsRow icon="bell" tone="peach" title="Hộp thông báo" badge={unread.data ?? 0} onPress={() => router.push("/notifications")} />
        <SettingsRow icon="gear" tone="mint" title="Cài đặt thông báo" subtitle="Đẩy, email và từng loại nhắc" onPress={() => router.push("/notification-settings")} />
        <SettingsRow last icon="mail" tone="blue" title="Tham gia bằng mã mời" subtitle="Nhập mã 8 ký tự hoặc mở lời mời" onPress={() => router.push("/invitation")} />
      </SettingsGroup>

      <SettingsGroup title="Bảo mật">
        <SettingsRow last icon="lock" tone="lilac" title="Phiên đăng nhập"
          value={sessions.data ? `${sessions.data.length} thiết bị` : undefined}
          subtitle="Xem nơi đang đăng nhập, đăng xuất từ xa"
          onPress={() => router.push("/sessions")} />
      </SettingsGroup>

      <SettingsGroup title="Wolfari" footer={`Wolfari v${Constants.expoConfig?.version ?? "1.0.0"} · Cùng nhau, đi xa hơn.`}>
        <SettingsRow last icon="compass" tone="mint" title="Xem chuyến đi mẫu" subtitle="Thử mọi tính năng với dữ liệu minh họa" onPress={() => router.push("/demo-trip")} />
      </SettingsGroup>

      {error && <Feedback message={error} />}
      <Button label="Đăng xuất" variant="destructive" onPress={() => { setError(undefined); setConfirm(true); }} />
      <Sheet visible={confirm} title="Đăng xuất khỏi Wolfari?" dismissible={!busy} onClose={() => setConfirm(false)}>
        <Text style={typography.body}>Thiết bị này sẽ ngừng nhận thông báo đẩy. Các thiết bị khác vẫn giữ đăng nhập.</Text>
        {error && <Feedback message={error} />}
        <Button label="Xác nhận đăng xuất" variant="destructive" loading={busy} onPress={() => { void logout(); }} />
        <Button label="Ở lại" variant="soft" disabled={busy} onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radii.cardLarge, overflow: "hidden", padding: 18, gap: 16, ...shadows.card },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarRing: { width: 86, height: 86, borderRadius: 43, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadows.floating },
  avatarEdit: { position: "absolute", right: 0, bottom: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  identity: { flex: 1, minWidth: 0, gap: 4, alignItems: "flex-start" },
  name: { ...typography.section, fontSize: 22, lineHeight: 28 },
  chip: { marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  chipOk: { backgroundColor: "rgba(255,255,255,0.75)" },
  chipWarn: { backgroundColor: colors.butter },
  chipText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
  passport: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.8)", borderRadius: radii.control, paddingVertical: 12 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, color: colors.ink },
  statLabel: { ...typography.footnote, fontSize: 12 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.line },
});
