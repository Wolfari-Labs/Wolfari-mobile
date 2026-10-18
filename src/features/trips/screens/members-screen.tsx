import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { useSession } from "@/features/auth/session/session-provider";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import {
  EmptyState,
  Heading,
  IconButton,
  ResourceFeedback,
  SectionLink,
  Segments,
  ui,
} from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { collectPages } from "../api/pagination";
import { useTrip } from "../hooks/use-trip";
import type { Invitation } from "../types";
import { dateLabel } from "../utils";

export default function MembersScreen() {
  const resource = useTrip();
  const { api, id, data } = resource;
  const { profile } = useSession();
  const command = useCommand();
  const owner = data?.trip.current_membership.role === "OWNER";
  const [includeLeft, setIncludeLeft] = useState(false);
  const members = useResource(
    useCallback(
      (signal: AbortSignal) =>
        collectPages((cursor) => api.trips.members(id, cursor, signal, includeLeft), signal),
      [api, id, includeLeft],
    ),
  );
  const invitations = useResource(
    useCallback(
      (signal: AbortSignal) =>
        collectPages(
          (cursor) => api.trips.invitations(id, cursor, signal),
          signal,
        ),
      [api, id],
    ),
    owner,
  );
  const [selected, setSelected] = useState<Invitation>();
  const [action, setAction] = useState<"resend" | "revoke">("resend");
  const pending =
    invitations.data?.filter((item) => item.status === "PENDING") ?? [];
  async function manage() {
    if (!selected) return;
    const result = await command.run(
      { id: selected.id, action, version: selected.version },
      (key) => api.trips.manageInvitation(id, selected, action, key),
    );
    if (result) {
      setSelected(undefined);
      await invitations.reload();
    }
  }
  return (
    <Screen
      title="Thành viên"
      tab="trips"
      onRefresh={() => {
        void resource.reload();
        void members.reload();
        void invitations.reload();
      }}
      refreshing={members.loading && !!members.data}
    >
      <Heading
        title="Bạn đồng hành"
        subtitle={`${members.data ? `${members.data.length} thành viên · ` : ""}${data?.trip.name ?? "Hành trình của nhóm"}`}
        aside={
          owner ? (
            <IconButton
              icon="plus"
              label="Mời thành viên"
              onPress={() =>
                router.push({ pathname: "/trip/[id]/invite", params: { id } })
              }
            />
          ) : undefined
        }
      />
      <ResourceFeedback
        {...resource}
        hasData={!!data}
        onRetry={() => {
          void resource.reload();
        }}
      />
      <ResourceFeedback
        {...members}
        hasData={!!members.data}
        onRetry={() => {
          void members.reload();
        }}
      />
      <Segments items={[{ value: "active", label: "Đang tham gia" }, { value: "all", label: "Cả lịch sử" }]} value={includeLeft ? "all" : "active"} onChange={value => setIncludeLeft(value === "all")} />
      {members.data?.map((member) => (
        <View key={member.id} style={ui.link}>
          <View style={ui.rowIcon}>
            <Text style={[typography.body, { color: colors.teal }]}>
              {member.user_id === profile?.id
                ? profile.full_name.charAt(0)
                : "W"}
            </Text>
          </View>
          <View style={ui.flex}>
            <Text style={typography.headline}>
              {member.user_id === profile?.id
                ? `${profile.full_name} · Bạn`
                : `Bạn đồng hành · ${member.user_id.slice(0, 8)}`}
            </Text>
            <Text style={[typography.footnote, { marginTop: 4 }]}>
              {member.role === "OWNER" ? "Người tổ chức" : "Thành viên"} · Tham
              gia {dateLabel(member.joined_at)}
              {member.left_at ? ` · Đã rời ${dateLabel(member.left_at)}` : ""}
            </Text>
            {owner && member.role === "MEMBER" && !member.left_at && data?.trip.lifecycle !== "ARCHIVED" && <Button label={`Xóa ${member.user_id.slice(0, 8)}`} variant="destructive" compact style={{ alignSelf: "flex-start", marginTop: 8 }} onPress={() => router.push({ pathname: "/trip/[id]/membership-action", params: { id, memberId: member.id } })} />}
          </View>
          {member.role === "OWNER" && (
            <Text style={[typography.footnote, { color: colors.teal }]}>
              Chủ nhóm
            </Text>
          )}
        </View>
      ))}
      {members.data && !members.data.length && (
        <EmptyState
          title="Chưa có thành viên"
          message="Tải lại để cập nhật những người đang tham gia chuyến đi."
          icon="users"
        />
      )}
      {owner && (
        <>
          <Text
            accessibilityRole="header"
            style={[typography.section, { marginTop: 20 }]}
          >
            Đang chờ phản hồi · {pending.length}
          </Text>
          <ResourceFeedback
            {...invitations}
            hasData={!!invitations.data}
            onRetry={() => {
              void invitations.reload();
            }}
          />
          {pending.map((invitation) => (
            <View key={invitation.id} style={ui.card}>
              <Text style={typography.headline}>
                {invitation.email ?? "Lời mời bằng liên kết"}
              </Text>
              <Text style={typography.footnote}>
                Hết hạn {dateLabel(invitation.expires_at)}
              </Text>
              <View style={ui.row}>
                {invitation.invitation_type === "EMAIL" && (
                  <Button
                    label="Gửi lại"
                    compact
                    variant="soft"
                    onPress={() => {
                      command.clearError();
                      setAction("resend");
                      setSelected(invitation);
                    }}
                  />
                )}
                <Button
                  label="Thu hồi"
                  compact
                  variant="destructive"
                  onPress={() => {
                    command.clearError();
                    setAction("revoke");
                    setSelected(invitation);
                  }}
                />
              </View>
            </View>
          ))}
          {!pending.length && invitations.data && (
            <Text style={typography.footnote}>
              Các lời mời đang chờ sẽ xuất hiện ở đây.
            </Text>
          )}
          <SectionLink
            title="Quyền của nhóm"
            subtitle="Ai có thể chỉnh sửa kế hoạch"
            icon="gear"
            onPress={() =>
              router.push({ pathname: "/trip/[id]/settings", params: { id } })
            }
          />
        </>
      )}
      <Sheet
        dismissible={!command.busy}
        visible={!!selected}
        title={action === "resend" ? "Gửi lại lời mời?" : "Thu hồi lời mời?"}
        onClose={() => {
          if (!command.busy) setSelected(undefined);
        }}
      >
        <Text style={typography.body}>
          {selected?.email ?? "Lời mời bằng liên kết"}
        </Text>
        <Text style={typography.footnote}>
          {action === "revoke"
            ? "Liên kết mời này sẽ không còn dùng để tham gia chuyến đi."
            : "Một lời mời mới sẽ được gửi tới địa chỉ email này."}
        </Text>
        {command.error && (
          <>
            <Feedback message={command.error} />
            <Button
              label="Tải lại lời mời"
              variant="soft"
              onPress={() => {
                setSelected(undefined);
                void invitations.reload();
              }}
            />
          </>
        )}
        <Button
          label={action === "resend" ? "Gửi lại lời mời" : "Xác nhận thu hồi"}
          variant={action === "revoke" ? "destructive" : "primary"}
          loading={command.busy}
          onPress={() => {
            void manage();
          }}
        />
      </Sheet>
    </Screen>
  );
}
