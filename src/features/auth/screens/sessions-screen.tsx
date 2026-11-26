import { DesignPopup } from "@/shared/ui/design-popup";
import { useCallback, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { collectPages } from "@/features/trips/api/pagination";
import { dateLabel } from "@/features/trips/utils";
import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { relativeTime, timeLeft } from "@/shared/relative-time";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState, ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { RowIcon, SettingsGroup, SettingsRow } from "@/shared/ui/settings-list";
import { Sheet } from "@/shared/ui/sheet";
import { toast } from "@/shared/ui/toast";
import { useSession } from "../session/session-provider";

type DeviceSession = {
  id: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
};

/**
 * Where this account is signed in. This device is marked and listed first (its row is
 * the session id login/refresh returned); others can be signed out one by one or together.
 */
export default function SessionsScreen() {
  const api = useApi();
  const command = useCommand();
  const { currentSessionId } = useSession();
  const [selected, setSelected] = useState<DeviceSession | "others">();
  const resource = useResource(
    useCallback(
      (signal: AbortSignal) =>
        collectPages<DeviceSession>(
          (cursor) =>
            api.request(
              `/me/sessions?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
              { signal },
            ),
          signal,
        ),
      [api],
    ),
  );
  const [deviceInfo, setDeviceInfo] = useState(false);
  const currentId = currentSessionId();
  const current = resource.data?.find((session) => session.id === currentId);
  const others = (resource.data ?? []).filter((session) => session.id !== currentId);
  async function revoke() {
    if (!selected) return;
    const targets = selected === "others" ? others : [selected];
    const result = await command.run({ revoke: targets.map((item) => item.id) }, async () => {
      for (const target of targets)
        await api.request(`/me/sessions/${encodeURIComponent(target.id)}`, { method: "DELETE" });
      return true;
    });
    if (result) {
      setSelected(undefined);
      toast.success(targets.length > 1 ? `Đã đăng xuất ${targets.length} thiết bị khác.` : "Đã đăng xuất thiết bị đó.");
      await resource.reload();
    } else {
      await resource.reload();
    }
  }
  return (
    <Screen
      title="Phiên đăng nhập"
      onRefresh={() => {
        void resource.reload();
      }}
      refreshing={resource.loading && !!resource.data}
    >
      <View style={styles.summary}>
        <RowIcon icon="lock" tone="lilac" size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={typography.headline}>
            {resource.data ? `Đang đăng nhập trên ${resource.data.length} thiết bị` : "Kiểm tra nơi đang đăng nhập"}
          </Text>
          <Text style={typography.footnote}>Thấy thiết bị lạ? Đăng xuất nó rồi đổi mật khẩu.</Text>
        </View>
      </View>
      <ResourceFeedback
        {...resource}
        hasData={!!resource.data}
        onRetry={() => {
          void resource.reload();
        }}
      />
      {current && (
        <SettingsGroup title="Thiết bị này">
          <SettingsRow
            last
            icon="user"
            tone="mint"
            title="Đang dùng"
            onPress={() => setDeviceInfo(true)}
            subtitle={`Đăng nhập ${dateLabel(current.created_at)} · Hết hạn ${timeLeft(current.expires_at)}`}
            right={<View style={styles.live}><View style={styles.liveDot} /><Text style={styles.liveText}>Hoạt động</Text></View>}
          />
        </SettingsGroup>
      )}
      {deviceInfo && current && <DesignPopup kind="device" message={`${Platform.OS === "web" ? "Trình duyệt này" : Platform.OS === "ios" ? "Thiết bị iOS này" : "Thiết bị Android này"} · Phiên hiện tại. Bạn đã đăng nhập ngày ${dateLabel(current.created_at)}.`} onPrimary={() => setDeviceInfo(false)} onClose={() => setDeviceInfo(false)} />}
      {others.length > 0 && (
        <SettingsGroup title={current ? "Thiết bị khác" : "Các phiên"} footer="Đăng xuất từ xa có hiệu lực ngay ở lần thiết bị đó gọi máy chủ.">
          {others.map((session, index) => (
            <SettingsRow
              key={session.id}
              last={index === others.length - 1}
              icon="lock"
              tone="neutral"
              title={`Hoạt động ${relativeTime(session.last_used_at ?? session.created_at)}`}
              subtitle={`Đăng nhập ${dateLabel(session.created_at)} · ${timeLeft(session.expires_at)}`}
              right={<Button label="Đăng xuất" accessibilityLabel={`Đăng xuất phiên đăng nhập ${dateLabel(session.created_at)}`} variant="text" compact onPress={() => { command.clearError(); setSelected(session); }} />}
            />
          ))}
        </SettingsGroup>
      )}
      {current && others.length > 1 && (
        <Button label={`Đăng xuất ${others.length} thiết bị khác`} variant="destructive" onPress={() => { command.clearError(); setSelected("others"); }} />
      )}
      {resource.data && !resource.data.length && (
        <EmptyState
          title="Không có phiên hoạt động"
          scene="quiet"
          message="Tải lại để kiểm tra trạng thái mới nhất."
          icon="lock"
        />
      )}
      {resource.data && current && !others.length && (
        <Text style={[typography.footnote, { textAlign: "center" }]}>Chỉ có thiết bị này đang đăng nhập.</Text>
      )}
      <Sheet
        dismissible={!command.busy}
        visible={!!selected}
        title={selected === "others" ? "Đăng xuất các thiết bị khác?" : "Đăng xuất thiết bị này từ xa?"}
        onClose={() => {
          if (!command.busy) setSelected(undefined);
        }}
      >
        <Text style={typography.body}>
          {selected === "others"
            ? `${others.length} thiết bị sẽ mất quyền truy cập và phải đăng nhập lại. Thiết bị bạn đang dùng giữ nguyên.`
            : current
              ? "Thiết bị đó sẽ mất quyền truy cập và phải đăng nhập lại."
              : "Phiên này sẽ mất quyền truy cập. Nếu là phiên bạn đang sử dụng, bạn sẽ cần đăng nhập lại."}
        </Text>
        {command.error && <Feedback message={command.error} />}
        <Button
          label="Xác nhận thu hồi"
          variant="destructive"
          loading={command.busy}
          onPress={() => {
            void revoke();
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  live: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.mint },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.pinGreen },
  liveText: { fontFamily: fonts.bold, fontSize: 12, color: colors.pinGreen },
});
