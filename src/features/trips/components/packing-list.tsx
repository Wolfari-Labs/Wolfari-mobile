import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useImperativeHandle, useState, type Ref } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCommand } from "@/shared/hooks/use-command";
import { colors, fonts, gradients, shadows } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DesignPopup } from "@/shared/ui/design-popup";
import { ClayAvatar, ClayChip } from "@/shared/ui/clay-form";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState } from "@/shared/ui/journal";
import { ClayIcon, claySubtitle } from "@/shared/ui/setting-card";
import { Sheet } from "@/shared/ui/sheet";
import type { useTrip } from "../hooks/use-trip";
import { memberName } from "../model/member-name";
import { categoryOrder, quantityLabel } from "../model/packing";
import type { Membership, PackingItem, Plan, Trip } from "../types";
import { dateLabel } from "../utils";

type Filter = "all" | "mine" | "todo";
export type PackingListHandle = { add(): void; chooseCategory(): void };

export function PackingList({
  ref,
  api,
  trip,
  plan,
  members,
  membersReady,
  reload,
}: {
  ref?: Ref<PackingListHandle>;
  api: ReturnType<typeof useTrip>["api"];
  trip: Trip;
  plan: Plan;
  members: Membership[];
  membersReady: boolean;
  reload: ReturnType<typeof useTrip>["reload"];
}) {
  const command = useCommand();
  const [filter, setFilter] = useState<Filter>("all");
  const [showCategories, setShowCategories] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>();
  const [readyCount, setReadyCount] = useState(0);
  const me = trip.current_membership.id;
  const items = plan.packing_items;
  const total = items.length;
  const done = items.filter((item) => item.status === "COMPLETED").length;
  const late = items.filter((item) => item.status !== "COMPLETED" && item.due_at && overdue(item.due_at)).length;
  const editable = plan.permissions.can_edit;
  const usedCategories = [...new Set(items.map(item => item.category || "Khác"))].sort(categoryOrder);
  const activeCategory = categoryFilter && usedCategories.includes(categoryFilter) ? categoryFilter : undefined;
  const matching = activeCategory ? items.filter(item => (item.category || "Khác") === activeCategory) : items;
  // Keep a row in place when someone ticks it in the full list.
  const rows = matching.filter((item) =>
    filter === "all" ? true : filter === "todo" ? item.status !== "COMPLETED" : item.assigned_member_id === me,
  );

  function open(item?: PackingItem) {
    router.push({ pathname: "/trip/[id]/packing-item", params: { id: trip.id, ...(item ? { itemId: item.id } : {}) } });
  }
  useImperativeHandle(ref, () => ({
    add: () => { if (!command.busy && membersReady && editable) open(); },
    chooseCategory: () => setShowCategories(true),
  }));
  async function complete(item: PackingItem) {
    const result = await command.run(
      { id: item.id, status: item.status, version: plan.plan_version },
      (key) => api.trips.completePacking(trip.id, item, plan.plan_version, key),
    );
    if (result) {
      const fresh = await reload();
      const list = fresh?.plan.packing_items;
      if (item.status !== "COMPLETED" && result.status === "COMPLETED" && list?.length && list.some(p => p.id === item.id) && list.every(p => p.status === "COMPLETED")) setReadyCount(list.length);
    }
  }
  const failure = command.error && (
    <>
      <Feedback message={command.error} />
      <Button
        label="Tải kế hoạch mới nhất"
        variant="soft"
        onPress={() => {
          command.clearError();
          void reload();
        }}
      />
    </>
  );
  const assigneeLabel = (item: PackingItem) => {
    if (!item.assigned_member_id) return "Cả nhóm";
    if (item.assigned_member_id === me) return "Bạn";
    const assignee = members.find((member) => member.id === item.assigned_member_id);
    return assignee ? memberName(assignee, trip.current_membership.user_id) : "Thành viên đã rời";
  };
  const memberNameOf = (item: PackingItem) => {
    const assignee = members.find((member) => member.id === item.assigned_member_id);
    return assignee ? memberName(assignee) : "Bạn";
  };
  const counts: Record<Filter, number> = {
    all: matching.length,
    mine: matching.filter((item) => item.assigned_member_id === me).length,
    todo: matching.filter((item) => item.status !== "COMPLETED").length,
  };
  const activeMembers = members.filter((member) => !member.left_at);
  const ready = total > 0 && done === total;

  return (
    <>
      <View style={styles.summary}>
        <LinearGradient pointerEvents="none" colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 32 }]} />
        <ProgressRing ratio={total ? done / total : 0} label={total ? `${Math.round((done / total) * 100)}%` : "–"} />
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryText}>Sẵn sàng lên đường</Text>
          <Text style={styles.count} numberOfLines={1} adjustsFontSizeToFit>{done} / {total} món</Text>
          <Text style={styles.summaryText}>
            {!total ? "Chưa có đồ cần mang" : ready ? "Đã đủ đồ, đi thôi!" : `Còn ${total - done} món cần chuẩn bị`}
          </Text>
          {late > 0 && <Text style={styles.summaryText}>{late} món quá hạn</Text>}
          {activeMembers.length > 0 && <View accessible accessibilityLabel={`${activeMembers.length} người cùng chuẩn bị`} style={styles.avatars}>
            {activeMembers.slice(0, 5).map((member, index) => <ClayAvatar key={member.id} name={memberName(member)} index={index} overlap={index > 0} />)}
          </View>}
        </View>
      </View>

      {activeCategory && <Button label={`${activeCategory} · Bỏ lọc`} variant="soft" compact onPress={() => setCategoryFilter(undefined)} />}
      <View accessibilityRole="tablist" style={styles.filters}>
        {([["all", "Tất cả"], ["mine", "Của tôi"], ["todo", "Chưa xong"]] as const).map(([value, label]) =>
          <ClayChip key={value} role="tab" label={`${label} · ${counts[value]}`} accessibilityLabel={label} selected={filter === value} onPress={() => setFilter(value)} />)}
      </View>

      {failure}
      {!rows.length && (
        <EmptyState
          title={total ? "Không có vật dụng phù hợp" : "Chưa có đồ cần mang"}
          scene={total ? "notFound" : "groupReady"}
          message={
            total
              ? filter === "todo"
                ? "Đã chuẩn bị xong các món trong danh sách này."
                : "Chưa có món nào được giao cho bạn trong danh sách này."
              : editable
                ? "Bấm + để thêm những món cả nhóm cần mang, phân công người chuẩn bị và đặt hạn."
                : "Người tổ chức sẽ thêm danh sách đồ cần mang cho chuyến đi."
          }
          icon="bag"
        />
      )}

      <View style={styles.list}>
        {rows.map((item) => {
          const completed = item.status === "COMPLETED";
          // Members may tick only their own or unassigned items, and undo only their own ticks.
          const canComplete =
            plan.permissions.can_complete &&
            (editable || !item.assigned_member_id || item.assigned_member_id === me) &&
            (!completed || editable || item.completed_by_user_id === trip.current_membership.user_id);
          const who = assigneeLabel(item);
          const isLate = !completed && !!item.due_at && overdue(item.due_at);
          const details = [who, item.category || "Khác", quantityLabel(item.quantity, item.unit)].filter(Boolean).join(" · ");
          return (
            <View key={item.id} style={styles.item}>
              <Pressable
                cssInterop={false}
                accessibilityRole="checkbox"
                accessibilityLabel={`${completed ? "Bỏ hoàn thành" : "Hoàn thành"} ${item.name}`}
                accessibilityState={{ checked: completed, disabled: !canComplete || command.busy }}
                aria-checked={completed}
                accessibilityHint={
                  canComplete ? undefined : "Chỉ người được phân công hoặc người tổ chức mới đánh dấu được món này."
                }
                disabled={!canComplete || command.busy}
                onPress={() => {
                  void complete(item);
                }}
                style={({ pressed }) => [styles.check, !canComplete && styles.checkLocked, pressed && { opacity: 0.6 }]}
              >
                <View style={[styles.checkBox, completed && { borderWidth: 0 }]}>
                  {completed && <>
                    <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 9 }]} />
                    <ClayIcon name="checkItem" size={14} />
                  </>}
                </View>
              </Pressable>
              <Pressable
                cssInterop={false}
                accessibilityRole={editable ? "button" : undefined}
                accessibilityLabel={editable ? `Sửa ${item.name}` : undefined}
                disabled={!editable || command.busy}
                onPress={() => open(item)}
                style={({ pressed }) => [styles.body, pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.name, completed && styles.nameDone]} numberOfLines={2}>{item.name}</Text>
                <Text style={claySubtitle} numberOfLines={2}>
                  {details}
                  {item.due_at && <Text style={isLate && styles.metaLate}> · {isLate ? "Quá hạn" : "Hạn"} {dateLabel(item.due_at, trip.timezone).slice(0, 5)}</Text>}
                </Text>
                {!!item.note && <Text numberOfLines={1} style={styles.note}>{item.note}</Text>}
              </Pressable>
              {item.assigned_member_id && <ClayAvatar name={who === "Bạn" ? memberNameOf(item) : who} index={activeMembers.findIndex((member) => member.id === item.assigned_member_id)} />}
            </View>
          );
        })}
      </View>

      <Sheet visible={showCategories} title="Lọc theo danh mục" onClose={() => setShowCategories(false)}>
        <View style={styles.options}>
          <ClayChip label="Mọi danh mục" selected={!activeCategory} onPress={() => { setCategoryFilter(undefined); setShowCategories(false); }} />
          {usedCategories.map(name => <ClayChip key={name} label={name} selected={activeCategory === name}
            onPress={() => { setCategoryFilter(name); setShowCategories(false); }} />)}
        </View>
      </Sheet>
      {readyCount > 0 && <DesignPopup kind="ready" message={`Cả nhóm đã chuẩn bị đủ ${readyCount}/${readyCount} món. Giờ thì đếm ngược đến ngày đi thôi.`} onPrimary={() => setReadyCount(0)} onClose={() => setReadyCount(0)} />}
    </>
  );
}

/** Two clipped half rings; no SVG module needed. */
function ProgressRing({ ratio, label }: { ratio: number; label: string }) {
  const right = 45 + Math.min(ratio, 0.5) * 360 - 180, left = 45 + Math.max(ratio - 0.5, 0) * 360 - 180;
  return (
    <View style={styles.ring}>
      <View style={styles.ringTrack} />
      <View style={[styles.ringHalf, { left: 48 }]}><View style={[styles.ringArc, { left: -45, borderTopColor: colors.surface, borderRightColor: colors.surface, transform: [{ rotate: `${right}deg` }] }]} /></View>
      <View style={[styles.ringHalf, { left: 0 }]}><View style={[styles.ringArc, { left: 3, borderBottomColor: colors.surface, borderLeftColor: colors.surface, transform: [{ rotate: `${left}deg` }] }]} /></View>
      <Text style={styles.ringText}>{label}</Text>
    </View>
  );
}

function overdue(dueAt: string) {
  return Date.parse(dueAt) < Date.now();
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 18, minHeight: 148, padding: 18, borderRadius: 32, marginTop: -6, ...shadows.card },
  summaryCopy: { flex: 1, minWidth: 0, gap: 4 },
  summaryText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.surface },
  count: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: colors.surface, fontVariant: ["tabular-nums"] },
  avatars: { flexDirection: "row" },
  ring: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  ringTrack: { position: "absolute", left: 3, top: 3, width: 90, height: 90, borderRadius: 45, borderWidth: 10, borderColor: "rgba(255,255,255,0.28)" },
  ringHalf: { position: "absolute", top: 0, width: 48, height: 96, overflow: "hidden" },
  ringArc: { position: "absolute", top: 3, width: 90, height: 90, borderRadius: 45, borderWidth: 10, borderColor: "transparent" },
  ringText: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, color: colors.surface, fontVariant: ["tabular-nums"] },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  list: { gap: 10 },
  item: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingRight: 14, borderRadius: 22, backgroundColor: colors.surface, ...shadows.glass },
  check: { width: 52, minHeight: 64, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  checkBox: { width: 26, height: 26, borderRadius: 9, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  checkLocked: { opacity: 0.45 },
  body: { flex: 1, minWidth: 0, paddingVertical: 11, paddingRight: 8 },
  name: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 22, color: colors.ink },
  nameDone: { textDecorationLine: "line-through", color: claySubtitle.color },
  metaLate: { color: colors.error },
  note: { color: colors.muted, fontSize: 12, fontStyle: "italic" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});
