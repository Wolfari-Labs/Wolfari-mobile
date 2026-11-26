import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError } from "@/shared/api/api-client";
import { errorMessage } from "@/shared/api/errors";
import { useResource } from "@/shared/hooks/use-resource";
import { randomUUID } from "@/shared/operations/operation-id";
import { colors, fonts, shadows } from "@/shared/theme/tokens";
import { WolfiScene } from "@/shared/ui/brand/wolfi-scene";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState, Notice, ResourceFeedback, Segments } from "@/shared/ui/journal";
import { PackingCheck } from "@/shared/ui/packing-check";
import { Screen } from "@/shared/ui/screen";
import { ClayButton } from "@/shared/ui/setting-card";
import { toast } from "@/shared/ui/toast";
import { useTrip } from "../hooks/use-trip";
import { appliedMessage, initialSelection, itemContext, itemTitle, sourceLine, warningLabel } from "../model/suggestions";
import type { Recommendation, RecommendationItem, RecommendationType } from "../types";

const TYPES: { value: RecommendationType; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "PACKING", label: "Hành lý" },
  { value: "DRESS_CODE", label: "Dress code" },
];

/** FR-DS01 / FR-DS03: preview rule-based packing and dress-code suggestions, then add the chosen ones. */
export default function SuggestionsScreen() {
  const { type: linked } = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<RecommendationType>(TYPES.some((t) => t.value === linked) ? (linked as RecommendationType) : "ALL");
  const trip = useTrip(true), { data, api, id } = trip;
  const preview = useResource(useCallback((signal: AbortSignal) => api.trips.previewRecommendation(id, { type }, signal), [api, id, type]));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"apply" | "ignore">();
  const [failure, setFailure] = useState<{ message: string; stale: boolean }>();
  const attempt = useRef<{ intent: string; key: string } | null>(null);
  const rec = preview.data;

  // A new preview resets the ticks (adjusting state while rendering, not in an effect).
  const [shown, setShown] = useState<Recommendation>();
  if (rec !== shown) {
    setShown(rec);
    setFailure(undefined);
    setSelected(rec ? initialSelection(rec) : new Set());
  }

  const canEdit = !!data?.plan.permissions.can_edit;
  const canApply = canEdit && !!rec?.can_apply && rec.status === "PREVIEWED";
  const toggle = (item: RecommendationItem) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    return next;
  });

  // Opened from a link there may be no screen to return to; go to the trip instead.
  const leave = () => { if (router.canGoBack()) router.back(); else router.replace({ pathname: "/trip/[id]", params: { id } }); };

  async function apply(recommendation: Recommendation) {
    if (busy || !selected.size) return;
    const item_ids = recommendation.items.filter((item) => selected.has(item.id)).map((item) => item.id);
    const intent = JSON.stringify([recommendation.id, item_ids]);
    // A lost response is retried with the same key, so the server applies it once.
    if (attempt.current?.intent !== intent) attempt.current = { intent, key: randomUUID() };
    setBusy("apply");
    setFailure(undefined);
    try {
      const result = await api.trips.applyRecommendation(recommendation.id, { item_ids, expected_plan_version: recommendation.base_plan_version }, attempt.current.key);
      attempt.current = null;
      toast.success(appliedMessage(result), { title: "Đã cập nhật chuyến đi" });
      void trip.reload();
      leave();
    } catch (cause) {
      const stale = cause instanceof ApiError && cause.status === 409;
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) attempt.current = null;
      setFailure({
        stale,
        message: stale ? "Lịch trình hoặc danh sách vừa thay đổi, hoặc gợi ý đã quá 30 phút. Tạo gợi ý mới để xem lại." : errorMessage(cause),
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function ignore(recommendation: Recommendation) {
    if (busy) return;
    setBusy("ignore");
    try {
      await api.trips.ignoreRecommendation(recommendation.id);
    } catch {
      // Ignoring only tidies the server record; an unanswered preview expires by itself.
    } finally {
      setBusy(undefined);
      leave();
    }
  }

  const packing = rec?.items.filter((item) => item.kind === "PACKING") ?? [];
  const dress = rec?.items.filter((item) => item.kind === "DRESS_CODE") ?? [];
  const count = rec ? rec.items.filter((item) => selected.has(item.id)).length : 0;

  return <Screen title="Gợi ý cho chuyến đi" tab="trips" onRefresh={() => { void preview.reload(); }} refreshing={preview.loading && !!rec}
    footer={rec && rec.items.length > 0 ? <View style={styles.footer}>
      {failure && <Feedback inline message={failure.message} />}
      {failure?.stale
        ? <ClayButton label="Tạo gợi ý mới" icon="sparkle" onPress={() => { void preview.reload(); }} />
        : <ClayButton label={count ? `Thêm ${count} mục đã chọn` : "Chọn mục muốn thêm"} loading={busy === "apply"} disabled={!canApply || !count || busy === "ignore"}
          onPress={() => { void apply(rec); }} />}
      {canApply && <ClayButton label="Bỏ qua lần này" tone="soft" loading={busy === "ignore"} disabled={busy === "apply"} onPress={() => { void ignore(rec); }} />}
    </View> : undefined}>
    <Text style={styles.intro}>Wolfi xem lịch trình và dự báo thời tiết rồi gợi ý. Danh sách của nhóm chỉ thay đổi khi bạn bấm Thêm.</Text>
    <Segments items={TYPES} value={type} onChange={(value) => setType(value)} />
    <ResourceFeedback loading={false} error={trip.error} hasData={!!data} onRetry={() => { void trip.reload(); }} />
    {preview.loading && !rec && <View accessibilityRole="progressbar" accessibilityLabel="Đang tạo gợi ý" style={{ gap: 10 }}>
      <WolfiScene name="sync" />
      <Text style={styles.waiting}>Đang xem thời tiết và lịch trình…</Text>
    </View>}
    {preview.error && !rec && <View style={styles.failure}>
      <WolfiScene name="saveFail" />
      <Text accessibilityRole="header" style={styles.failureTitle}>Wolfi chưa tạo được gợi ý</Text>
      <Text style={styles.failureText}>{preview.error} Lịch trình và hành lý của nhóm không bị ảnh hưởng.</Text>
      <ClayButton label="Thử lại" tone="soft" onPress={() => { void preview.reload(); }} />
    </View>}
    {rec && <>
      {data && !canEdit && <Notice>Bạn đang xem gợi ý. Người có quyền chỉnh sửa lịch trình mới thêm được vào chuyến đi.</Notice>}
      {rec.warnings.map((code) => warningLabel(code) && <Notice key={code}>{warningLabel(code)}</Notice>)}
      {rec.items.length === 0
        ? <EmptyState scene="saveOk" title="Chưa có gợi ý mới" message="Hành lý và trang phục của nhóm đã khớp với lịch trình và thời tiết hiện tại." />
        : <>
          {packing.length > 0 && <Group title="Hành lý" items={packing} selected={selected} disabled={!canApply} onToggle={toggle} activities={data?.plan.activities ?? []} />}
          {dress.length > 0 && <Group title="Dress code" items={dress} selected={selected} disabled={!canApply} onToggle={toggle} activities={data?.plan.activities ?? []} />}
        </>}
      {rec.sources.length > 0 && <View style={styles.sources}>
        {rec.sources.map((source, index) => <View key={`${source.provider}-${index}`} style={{ gap: 2 }}>
          <Text style={[styles.sourceText, (source.stale || source.is_mock) && { color: colors.orange }]}>Thời tiết: {sourceLine(source, data?.trip.timezone ?? "Asia/Ho_Chi_Minh")}</Text>
          {source.attribution.map((credit) => <Text key={credit.url} accessibilityRole="link" onPress={() => { void Linking.openURL(credit.url); }} style={styles.credit}>{credit.text}</Text>)}
        </View>)}
      </View>}
    </>}
  </Screen>;
}

function Group({ title, items, selected, disabled, onToggle, activities }: {
  title: string; items: RecommendationItem[]; selected: Set<string>; disabled: boolean;
  onToggle: (item: RecommendationItem) => void; activities: { id: string; title: string }[];
}) {
  return <View style={{ gap: 10 }}>
    <Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text>
    {items.map((item) => {
      const checked = selected.has(item.id), name = itemTitle(item), context = itemContext(item, activities);
      const note = item.warnings.map(warningLabel).find(Boolean);
      return <Pressable key={item.id} cssInterop={false} accessibilityRole="checkbox" accessibilityLabel={name}
        accessibilityHint={item.reasons.join(". ")} accessibilityState={{ checked, disabled }} aria-checked={checked}
        disabled={disabled} onPress={() => onToggle(item)}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }, disabled && { opacity: 0.7 }]}>
        <PackingCheck checked={checked} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name}>{name}</Text>
          {context && <Text style={styles.context}>{context}</Text>}
          {item.reasons.map((reason) => <Text key={reason} style={styles.reason}>• {reason}</Text>)}
          {note && <Text style={styles.note}>{note}</Text>}
        </View>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  waiting: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: "center" },
  groupTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.ink, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.surface, ...shadows.card },
  name: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  context: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: colors.teal },
  reason: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink },
  note: { alignSelf: "flex-start", fontFamily: fonts.bold, fontSize: 11, lineHeight: 15, color: colors.amber, backgroundColor: colors.butter, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: "hidden" },
  sources: { gap: 8, paddingTop: 4 },
  sourceText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: colors.muted },
  credit: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: colors.teal, textDecorationLine: "underline" },
  footer: { gap: 10 },
  failure: { gap: 12, padding: 14, paddingBottom: 18, borderRadius: 30, borderCurve: "continuous", backgroundColor: colors.surface, ...shadows.card },
  failureTitle: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 25, color: colors.ink, textAlign: "center", marginTop: 4 },
  failureText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: "center", paddingHorizontal: 6 },
});
