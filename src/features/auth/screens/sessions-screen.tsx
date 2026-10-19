import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { collectPages } from "@/features/trips/api/pagination";
import { dateLabel } from "@/features/trips/utils";
import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState, Heading, ResourceFeedback, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";

type DeviceSession = {
  id: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
};
export default function SessionsScreen() {
  const api = useApi();
  const command = useCommand();
  const [selected, setSelected] = useState<DeviceSession>();
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
  async function revoke() {
    if (!selected) return;
    const result = await command.run({ revoke: selected.id }, async () => {
      await api.request(`/me/sessions/${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
      });
      return true;
    });
    if (result) {
      setSelected(undefined);
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
      <Heading
        title="Tài khoản trong tầm tay"
        subtitle="Quản lý những phiên có quyền truy cập Wolfari."
      />
      <ResourceFeedback
        {...resource}
        hasData={!!resource.data}
        onRetry={() => {
          void resource.reload();
        }}
      />
      {resource.data?.map((session) => (
        <View style={ui.card} key={session.id}>
          <Text style={typography.headline}>
            Phiên · {session.id.slice(0, 8)}
          </Text>
          <Text style={typography.footnote}>
            Đăng nhập {dateLabel(session.created_at)}
          </Text>
          <Text style={typography.footnote}>
            Sử dụng gần nhất:{" "}
            {session.last_used_at
              ? dateLabel(session.last_used_at)
              : "Chưa ghi nhận"}
          </Text>
          <Button
            label="Thu hồi phiên này"
            variant="destructive"
            compact
            onPress={() => {
              command.clearError();
              setSelected(session);
            }}
          />
        </View>
      ))}
      {resource.data && !resource.data.length && (
        <EmptyState
          title="Không có phiên hoạt động"
          message="Tải lại để kiểm tra trạng thái mới nhất."
          icon="lock"
        />
      )}
      <Sheet
        dismissible={!command.busy}
        visible={!!selected}
        title="Thu hồi phiên đăng nhập?"
        onClose={() => {
          if (!command.busy) setSelected(undefined);
        }}
      >
        <Text style={typography.body}>
          Phiên này sẽ mất quyền truy cập. Nếu là phiên bạn đang sử dụng, bạn sẽ
          cần đăng nhập lại.
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
