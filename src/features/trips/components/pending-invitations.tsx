import { router } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, shadows, typography } from "@/shared/theme/tokens";
import { ClayAvatar } from "@/shared/ui/clay-form";
import { Feedback } from "@/shared/ui/feedback";
import { ClayButton } from "@/shared/ui/setting-card";
import { toast } from "@/shared/ui/toast";
import type { InvitationPreview } from "../types";
import { dateLabel } from "../utils";
import { tripDatesLabel } from "../model/invitation-labels";

/**
 * Email invitations addressed to the signed-in person's verified email, like the "pending
 * invitations" list of Splitwise or Notion: someone who installs the app after being invited
 * finds the trip here without opening the email. The server re-checks everything on answer.
 */
export function PendingInvitations({ onEmpty }: { onEmpty?: (empty: boolean) => void }) {
  const api = useApi();
  const command = useCommand();
  const [answered, setAnswered] = useState<string[]>([]);
  const resource = useResource(
    useCallback(
      async (signal: AbortSignal) => {
        const result = await api.trips.myInvitations(signal);
        onEmpty?.(!result.items.length);
        return result.items;
      },
      [api, onEmpty],
    ),
  );
  const items = (resource.data ?? []).filter((item) => !answered.includes(item.id));
  async function respond(item: InvitationPreview, action: "accept" | "decline") {
    const result = await command.run({ action, invitation: item.id }, (key) =>
      api.trips.respondInvitationById(item.id, action, key),
    );
    if (!result) return;
    setAnswered((current) => [...current, item.id]);
    if (action === "accept" && result.membership) {
      toast.celebrate("Lịch trình, hành lý và quỹ chung của nhóm đã mở cho bạn.", {
        title: `Chào mừng tới ${item.trip_name}`,
      });
      router.replace({ pathname: "/trip/[id]", params: { id: result.membership.trip_id } });
    } else toast.info("Đã từ chối lời mời.");
  }
  if (!items.length && !command.error) return null;
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={typography.section}>
        Lời mời đang chờ bạn
      </Text>
      {command.error && <Feedback message={command.error} />}
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.row}>
            <ClayAvatar name={item.inviter_display_name || "Wolfari"} index={0} />
            <View style={{ flex: 1 }}>
              <Text style={typography.headline}>
                {(item.inviter_display_name || "Một thành viên") + " mời bạn"}
              </Text>
              <Text style={typography.footnote}>Hết hạn {dateLabel(item.expires_at)}</Text>
            </View>
          </View>
          <Text style={typography.title}>{item.trip_name}</Text>
          {tripDatesLabel(item) && <Text style={typography.body}>{tripDatesLabel(item)}</Text>}
          <View style={{ gap: 8 }}>
            <ClayButton
              label="Tham gia chuyến đi"
              icon="arrowRight"
              loading={command.busy}
              accessibilityLabel={`Tham gia ${item.trip_name}`}
              onPress={() => {
                void respond(item, "accept");
              }}
            />
            <ClayButton
              label="Từ chối"
              tone="secondary"
              disabled={command.busy}
              accessibilityLabel={`Từ chối lời mời ${item.trip_name}`}
              onPress={() => {
                void respond(item, "decline");
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: 26, backgroundColor: colors.surface, ...shadows.card },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
