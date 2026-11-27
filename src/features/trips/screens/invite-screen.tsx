import { DesignPopup } from "@/shared/ui/design-popup";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { colors, fonts, radii, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Heading, Notice, ResourceFeedback, SectionLink, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { InviteQr } from "../components/invite-qr";
import { useTrip } from "../hooks/use-trip";
import { inviteMessage } from "../model/invite-message";
import { GROUP_LINK_USES, invitationUsesLabel } from "../model/invitation-labels";
import type { InvitationResult } from "../types";
import { dateLabel } from "../utils";

const STEPS = [
  "Gửi lời mời qua Zalo, Messenger, tin nhắn — hoặc cho bạn quét QR ngay tại chỗ.",
  "Bạn bè mở liên kết (hoặc quét QR), hoặc vào Wolfari → Tài khoản → Tham gia bằng mã mời và nhập mã.",
  "Khi có người nhận lời, bạn nhận thông báo và thấy họ trong Bạn đồng hành.",
];

export default function InviteScreen() {
  const resource = useTrip();
  const { data, api, id } = resource;
  const command = useCommand();
  const [kind, setKind] = useState<"LINK" | "EMAIL">("LINK");
  // Like a chat group link: one code for the whole group by default, or one for a single person.
  const [audience, setAudience] = useState<"GROUP" | "ONE">("GROUP");
  const [email, setEmail] = useState("");
  const [validation, setValidation] = useState<string>();
  const [result, setResult] = useState<InvitationResult>();
  const [showReady, setShowReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string>();
  const code = result?.join_code;
  const archived = data?.trip.lifecycle === "ARCHIVED";
  // Only the Owner invites (SRS FR-TR03); the server decides through can_invite.
  const allowed = !archived && (data?.trip.permissions.can_invite ?? data?.trip.current_membership.role === "OWNER");
  const uses = audience === "GROUP" ? GROUP_LINK_USES : 1;
  const writable = allowed && !resource.loading && !resource.error;

  async function copy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
  }
  async function share() {
    if (!data || !result || !code) return;
    setShareError(undefined);
    const message = inviteMessage({
      tripName: data.trip.name,
      code,
      expiresLabel: dateLabel(result.invitation.expires_at),
      link: result.share_link,
      maxUses: result.invitation.max_uses,
    });
    try {
      await Share.share({ message, title: `Lời mời: ${data.trip.name}` });
    } catch {
      setShareError("Thiết bị này chưa mở được bảng chia sẻ. Hãy sao chép mã và gửi cho bạn bè.");
    }
  }
  async function submit() {
    if (!data || !writable) return;
    if (kind === "EMAIL" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 255)) {
      setValidation("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }
    setValidation(undefined);
    const response = await command.run(
      {
        kind,
        email: kind === "EMAIL" ? email.trim().toLowerCase() : undefined,
        uses: kind === "LINK" ? uses : undefined,
        revision: data.trip.membership_revision,
      },
      (key) => (kind === "EMAIL" ? api.trips.invite(data.trip, email, key) : api.trips.inviteLink(data.trip, key, uses)),
    );
    if (response) {
      setResult(response);
      setShowReady(true);
      setCopied(false);
    }
  }
  /** The secret code is returned only once; a new code means revoking this one first. */
  async function regenerate() {
    if (!result || !writable) return;
    const old = result.invitation;
    const revoked = await command.run({ revoke: old.id, version: old.version }, (key) =>
      api.trips.manageInvitation(id, old, "revoke", key),
    );
    if (!revoked) return;
    const fresh = await resource.reload();
    if (!fresh) return;
    const keepUses = old.max_uses ?? 1;
    const next = await command.run({ kind: "LINK", replaces: old.id, uses: keepUses, revision: fresh.trip.membership_revision }, (key) =>
      api.trips.inviteLink(fresh.trip, key, keepUses),
    );
    if (next) {
      setResult(next);
      setShowReady(true);
      setCopied(false);
    } else setResult(undefined);
  }
  function reset() {
    setResult(undefined);
    setEmail("");
    setCopied(false);
    setShareError(undefined);
  }

  return (
    <Screen
      title="Mời thành viên"
      bottomPadding={24}
      footer={
        allowed && !result ? (
          <Button
            label={kind === "EMAIL" ? "Gửi lời mời" : "Tạo mã mời"}
            loading={command.busy}
            disabled={!writable}
            onPress={() => {
              void submit();
            }}
          />
        ) : undefined
      }
    >
      <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
      {data &&
        (allowed ? (
          <>
            <Heading
              title={"Đi cùng nhau,\nvui hơn nhiều!"}
              aside={<Image source={designAssets.mascot} style={{ width: 84, height: 84 }} contentFit="contain" />}
              subtitle={"Mời bạn bè tham gia " + data.trip.name + "."}
            />
            {command.error && (
              <>
                <Feedback message={command.error} />
                <Button label="Cập nhật thông tin nhóm" variant="soft" compact onPress={() => { void resource.reload(); }} />
              </>
            )}
            {result ? (
              <>
                <Feedback
                  inline
                  success
                  message={
                    (result.invitation.email ? "Lời mời cho " + result.invitation.email : "Mã mời") +
                    " đã được tạo. Hết hạn " +
                    dateLabel(result.invitation.expires_at) +
                    "."
                  }
                />
                {code ? (
                  <View style={styles.ticket}>
                    <View style={styles.ticketHead}>
                      <DesignIcon name="users" size={18} tintColor={colors.teal} />
                      <Text style={[typography.headline, { flex: 1 }]}>Mã mời vào nhóm</Text>
                      <Text style={styles.expiry}>{invitationUsesLabel(result.invitation)} · hết hạn {dateLabel(result.invitation.expires_at)}</Text>
                    </View>
                    <Text selectable accessibilityLabel={`Mã mời ${code.split("").join(" ")}`} style={styles.code}>
                      {code}
                    </Text>
                    {/* Any phone camera opens the web invitation page (https) carrying the code; the
                        app-only link is a fallback for servers that do not return share_link. */}
                    <InviteQr
                      value={result.share_link ?? Linking.createURL("/invitation", { queryParams: { code } })}
                      label={`Mã QR lời mời ${code}`}
                    />
                    <Text style={[typography.footnote, { textAlign: "center" }]}>Bạn ngồi cạnh có thể quét QR bằng camera điện thoại.</Text>
                    <Button
                      label="Chia sẻ mã mời"
                      icon="users"
                      onPress={() => {
                        void share();
                      }}
                    />
                    <Button
                      label={copied ? "Đã sao chép ✓" : "Sao chép mã"}
                      variant="soft"
                      compact
                      onPress={() => {
                        void copy();
                      }}
                    />
                    {shareError && <Feedback message={shareError} />}
                    <View style={styles.steps}>
                      {STEPS.map((step, index) => (
                        <View key={step} style={styles.step}>
                          <Text style={styles.stepIndex}>{index + 1}</Text>
                          <Text style={[typography.footnote, { flex: 1 }]}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  result.invitation.invitation_type === "LINK" && (
                    <Notice>
                      Máy chủ không trả lại mã ở lần thử này. Hãy tạo mã mới; mã cũ sẽ được thu hồi.
                    </Notice>
                  )
                )}
                {result.invitation.invitation_type === "LINK" && (
                  <Button
                    label="Tạo mã mới (thu hồi mã này)"
                    variant="soft"
                    compact
                    loading={command.busy}
                    disabled={!writable}
                    onPress={() => {
                      void regenerate();
                    }}
                  />
                )}
                <Button label="Mời thêm một người bạn" variant="soft" disabled={command.busy} onPress={reset} />
                <Button
                  label="Xem bạn đồng hành"
                  variant="text"
                  onPress={() => router.replace({ pathname: "/trip/[id]/members", params: { id } })}
                />
              </>
            ) : (
              <>
                <Segments
                  items={[
                    { value: "LINK", label: "Bằng mã mời" },
                    { value: "EMAIL", label: "Qua email" },
                  ]}
                  value={kind}
                  onChange={(value) => {
                    if (!command.busy) {
                      setKind(value);
                      setValidation(undefined);
                    }
                  }}
                />
                {validation && <Feedback message={validation} />}
                {kind === "EMAIL" ? (
                  <>
                    <FormField
                      label="Email người được mời"
                      icon="mail"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      placeholder="banbe@email.com"
                      editable={!command.busy}
                    />
                    <Text style={typography.footnote}>
                      Wolfari gửi email kèm liên kết. Người nhận đăng nhập bằng đúng email này để nhận lời.
                    </Text>
                  </>
                ) : (
                  <View style={styles.steps}>
                    {STEPS.map((step, index) => (
                      <View key={step} style={styles.step}>
                        <Text style={styles.stepIndex}>{index + 1}</Text>
                        <Text style={[typography.footnote, { flex: 1 }]}>{step}</Text>
                      </View>
                    ))}
                    <Segments
                      items={[
                        { value: "GROUP", label: `Cả nhóm (tối đa ${GROUP_LINK_USES})` },
                        { value: "ONE", label: "Một người" },
                      ]}
                      value={audience}
                      onChange={(value) => {
                        if (!command.busy) setAudience(value);
                      }}
                    />
                    <Text style={typography.footnote}>
                      {audience === "GROUP"
                        ? `Một mã cho cả nhóm, như link nhóm chat: tối đa ${GROUP_LINK_USES} người, mỗi tài khoản vào một lần. Chỉ gửi trong nhóm của bạn; ai có mã còn hạn đều có thể vào.`
                        : "Mã dùng cho một người. Chỉ gửi cho người bạn muốn mời; ai có mã còn hạn đều có thể nhận lời."}
                    </Text>
                  </View>
                )}
              </>
            )}
            <SectionLink
              title="Lời mời đang chờ"
              subtitle="Gửi lại hoặc thu hồi trong Bạn đồng hành"
              icon="users"
              onPress={() => router.push({ pathname: "/trip/[id]/members", params: { id } })}
            />
          </>
        ) : (
          <EmptyState
            title={archived ? "Chuyến đi đã lưu trữ" : "Cùng mời bạn bè"}
            scene={archived ? "quiet" : "inviteSent"}
            message={
              archived
                ? "Không thể tạo lời mời cho chuyến đi đã lưu trữ. Bạn vẫn có thể xem danh sách thành viên."
                : "Chỉ người tổ chức chuyến đi mời được bạn bè. Hãy nhờ người tổ chức gửi mã hoặc lời mời."
            }
            icon="users"
          />
        ))}
      {showReady && result && <DesignPopup kind="invitation" message={kind === "EMAIL" ? `Đã tạo lời mời cho ${email.trim()} tham gia ${data?.trip.name}.` : "Mã mời đã sẵn sàng. Mở mã để sao chép hoặc gửi cho bạn đồng hành."}
        secondaryLabel={code ? "Xem mã mời" : "Xem lời mời"}
        onPrimary={() => router.dismissTo({ pathname: "/trip/[id]/members", params: { id } })}
        onClose={() => setShowReady(false)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ticket: {
    gap: 12,
    padding: 18,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.teal,
  },
  ticketHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  expiry: { color: colors.muted, fontSize: 12, fontFamily: fonts.bold },
  code: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radii.control,
    backgroundColor: colors.tealSoft,
    color: colors.ink,
    fontSize: 30,
    fontFamily: fonts.bold,
    textAlign: "center",
    letterSpacing: 4,
    fontVariant: ["tabular-nums"],
  },
  steps: { gap: 10 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.surface,
    backgroundColor: colors.teal,
  },
});
