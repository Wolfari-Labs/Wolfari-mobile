import { router } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { PageIntro, type PageIntroProps } from "@/shared/ui/page-intro";
import { Sheet } from "@/shared/ui/sheet";
import { demoMembers } from "./model";

export function DemoScreen({
  title,
  children,
  footer,
  home = false,
  onBack,
  intro,
  summary,
}: PropsWithChildren<{
  title: string;
  footer?: ReactNode;
  home?: boolean;
  onBack?: () => void;
  intro?: Omit<PageIntroProps, "badge" | "summary">;
  summary?: ReactNode;
}>) {
  return (
    <Screen
      title={title}
      footer={footer}
      onBack={
        onBack ??
        (() => {
          if (!home) router.dismissTo("/demo-trip");
          else if (router.canGoBack()) router.back();
          else router.replace("/");
        })
      }
    >
      {intro ? <PageIntro {...intro} summary={summary} badge="CHUYẾN ĐI MẪU · Không lưu lên máy chủ" /> : <View style={styles.banner}>
        <View style={styles.dot} />
        <View style={ui.flex}>
          <Text
            style={[
              typography.headline,
              { fontSize: 13, color: colors.tealPressed },
            ]}
          >
            CHUYẾN ĐI MẪU
          </Text>
          <Text style={typography.footnote}>
            Thử tự do · Không lưu lên máy chủ
          </Text>
        </View>
      </View>}
      {children}
    </Screen>
  );
}
export function MemberBadge({ id, suffix }: { id: string; suffix?: string }) {
  const member = demoMembers.find((m) => m.id === id);
  return (
    <View style={styles.member}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: member?.color ?? colors.fill },
        ]}
      >
        <Text style={styles.initials}>{member?.initials ?? "—"}</Text>
      </View>
      <Text style={typography.footnote}>
        {member?.name ?? "Chưa phân công"}
        {suffix ? ` · ${suffix}` : ""}
      </Text>
    </View>
  );
}
export function MemberPicker({
  value,
  onChange,
  optional = false,
  label = "Phân công",
}: {
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  label?: string;
}) {
  return (
    <View style={ui.stack}>
      <Text style={typography.headline}>{label}</Text>
      <Segments
        scroll
        value={value}
        onChange={onChange}
        items={[
          ...(optional ? [{ value: "", label: "Chưa giao" }] : []),
          ...demoMembers.map((m) => ({ value: m.id, label: m.name })),
        ]}
      />
    </View>
  );
}
export function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={typography.footnote}>{label}</Text>
      <Text
        style={[typography.headline, accent && { color: colors.tealPressed }]}
      >
        {value}
      </Text>
    </View>
  );
}
export function ConfirmSheet({
  visible,
  title,
  message,
  label,
  error,
  onConfirm,
  onClose,
  destructive = false,
}: {
  visible: boolean;
  title: string;
  message: string;
  label: string;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
  destructive?: boolean;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Text style={typography.body}>{message}</Text>
      {error && <Feedback message={error} />}
      <Button
        label={label}
        variant={destructive ? "destructive" : "primary"}
        onPress={onConfirm}
      />
      <Button label="Giữ nguyên" variant="soft" onPress={onClose} />
    </Sheet>
  );
}
export const demoStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  split: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  eyebrow: {
    ...typography.footnote,
    color: colors.tealPressed,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  heading: { ...typography.title, fontSize: 28, lineHeight: 34 },
  subtle: { ...typography.body, color: colors.muted },
  label: { ...typography.footnote, fontWeight: "600" },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.tealSoft,
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal },
  member: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontSize: 10, color: colors.ink, fontWeight: "700" },
  stat: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 0,
    paddingVertical: 12,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
