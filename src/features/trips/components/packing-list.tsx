import { errorMessage } from "@/shared/api/errors";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCommand } from "@/shared/hooks/use-command";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, IconButton, Notice, Progress, Segments, ui } from "@/shared/ui/journal";
import { PackingCheck } from "@/shared/ui/packing-check";
import { Sheet } from "@/shared/ui/sheet";
import type { useTrip } from "../hooks/use-trip";
import { memberName } from "../model/member-name";
import {
  CATEGORY_MAX,
  PACKING_UNITS,
  categoryIcon,
  categoryOrder,
  normalizeCategory,
  packingForm,
  packingInput,
  quantityLabel,
  tripCategories,
  type PackingForm,
} from "../model/packing";
import type { Membership, PackingItem, Plan, Trip } from "../types";
import { dateLabel } from "../utils";

type Filter = "all" | "mine" | "todo";
const TILE_COLORS = [colors.tealSoft, colors.mint, colors.butter, colors.lilac, colors.peach, colors.ice];

export function PackingList({
  api,
  trip,
  plan,
  members,
  membersReady,
  reload,
}: {
  api: ReturnType<typeof useTrip>["api"];
  trip: Trip;
  plan: Plan;
  members: Membership[];
  membersReady: boolean;
  reload(): Promise<unknown> | void;
}) {
  const command = useCommand();
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [form, setForm] = useState<PackingForm>(),
    [error, setError] = useState<string>();
  // Typing a brand-new category instead of picking a chip.
  const [newCategory, setNewCategory] = useState<string>();
  const [deleting, setDeleting] = useState<PackingItem>();
  const [saved, setSaved] = useState<string>();
  const me = trip.current_membership.id;
  const items = plan.packing_items;
  const total = items.length;
  const done = items.filter((item) => item.status === "COMPLETED").length;
  const myOpen = items.filter((item) => item.assigned_member_id === me && item.status !== "COMPLETED").length;
  const late = items.filter((item) => item.status !== "COMPLETED" && item.due_at && overdue(item.due_at)).length;
  const editable = plan.permissions.can_edit;
  const categories = tripCategories(items);
  const rows = items.filter((item) =>
    filter === "all" ? true : filter === "todo" ? item.status !== "COMPLETED" : item.assigned_member_id === me,
  );
  const groups = [...new Set(rows.map((item) => item.category || "Khác"))].sort(categoryOrder).map((name) => {
    const list = rows
      .filter((item) => (item.category || "Khác") === name)
      // Unfinished first: the list reads as "what is left".
      .sort((a, b) => Number(a.status === "COMPLETED") - Number(b.status === "COMPLETED"));
    const all = items.filter((item) => (item.category || "Khác") === name);
    return { name, items: list, done: all.filter((item) => item.status === "COMPLETED").length, total: all.length };
  });

  function open(item?: PackingItem, category?: string) {
    command.clearError();
    setError(undefined);
    setSaved(undefined);
    setNewCategory(undefined);
    const next = packingForm(item, trip.timezone);
    setForm(category ? { ...next, category } : next);
  }
  const change = (field: keyof PackingForm, value: string) => {
    setError(undefined);
    setForm((old) => old && { ...old, [field]: value });
  };
  async function save() {
    if (!form || !membersReady || !editable) return;
    try {
      const category = newCategory !== undefined ? normalizeCategory(newCategory, categories) : form.category;
      const input = packingInput(
        { ...form, category },
        { members, timezone: trip.timezone, planVersion: plan.plan_version },
      );
      const result = await command.run({ id: form.id, ...input }, (key) =>
        api.trips.savePacking(trip.id, form.id, input, key),
      );
      if (result) {
        setForm(undefined);
        setNewCategory(undefined);
        setSaved("Đã lưu vật dụng cho cả nhóm.");
        // A newly added item should be visible even if its group was folded.
        setCollapsed((names) => names.filter((name) => name !== (input.category || "Khác")));
        await reload();
      }
    } catch (cause) {
      setError(errorMessage(cause, "Kiểm tra thông tin vật dụng."));
    }
  }
  async function complete(item: PackingItem) {
    setSaved(undefined);
    const result = await command.run(
      { id: item.id, status: item.status, version: plan.plan_version },
      (key) => api.trips.completePacking(trip.id, item, plan.plan_version, key),
    );
    if (result) await reload();
  }
  async function remove() {
    if (!deleting || !editable) return;
    const result = await command.run({ id: deleting.id, version: plan.plan_version }, (key) =>
      api.trips.removePacking(trip.id, deleting.id, plan.plan_version, key),
    );
    if (result) {
      setDeleting(undefined);
      setSaved("Đã xóa vật dụng khỏi danh sách chung.");
      await reload();
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
          setForm(undefined);
          setDeleting(undefined);
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
  const counts: Record<Filter, number> = {
    all: total,
    mine: items.filter((item) => item.assigned_member_id === me).length,
    todo: total - done,
  };
  const ready = total > 0 && done === total;

  return (
    <>
      <View style={[styles.summary, ready && styles.summaryDone]}>
        <View style={ui.row}>
          <View style={ui.flex}>
            <Text style={typography.footnote}>Cả nhóm đã chuẩn bị</Text>
            <Text style={styles.count}>
              {done}
              <Text style={styles.countTotal}> / {total} món</Text>
            </Text>
          </View>
          <View style={[styles.ring, ready && styles.ringDone]}>
            <Text style={[styles.ringText, ready && { color: colors.pinGreen }]}>
              {ready ? "✓" : total ? `${Math.round((done / total) * 100)}%` : "–"}
            </Text>
          </View>
        </View>
        {total > 0 && <Progress done={done} total={total} />}
        <View style={styles.stats}>
          <Text style={styles.stat}>
            {!total ? "Chưa có đồ cần mang" : ready ? "Đã đủ đồ, sẵn sàng lên đường!" : `Còn ${total - done} món`}
          </Text>
          {myOpen > 0 && <Text style={[styles.stat, styles.statMine]}>Bạn còn {myOpen} món</Text>}
          {late > 0 && <Text style={[styles.stat, styles.statLate]}>{late} món quá hạn</Text>}
        </View>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.filters}>
          {(
            [
              ["all", "Tất cả"],
              ["mine", "Của tôi"],
              ["todo", "Chưa xong"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              cssInterop={false}
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: filter === value }}
              onPress={() => setFilter(value)}
              style={({ pressed }) => [styles.filter, filter === value && styles.filterActive, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
                {label} <Text style={styles.filterCount}>{counts[value]}</Text>
              </Text>
            </Pressable>
          ))}
        </View>
        {editable && (
          <IconButton icon="plus" label="Thêm vật dụng" disabled={command.busy || !membersReady} onPress={() => open()} />
        )}
      </View>

      {saved && <Feedback success message={saved} />}
      {!form && !deleting && failure}
      {!rows.length && (
        <EmptyState
          title={total ? "Không có vật dụng phù hợp" : "Chưa có đồ cần mang"}
          message={
            total
              ? filter === "todo"
                ? "Mọi món đã được chuẩn bị xong."
                : "Chưa có món nào được giao cho bạn."
              : editable
                ? "Bấm + để thêm những món cả nhóm cần mang, phân công người chuẩn bị và đặt hạn."
                : "Người tổ chức sẽ thêm danh sách đồ cần mang cho chuyến đi."
          }
          icon="bag"
        />
      )}

      {groups.map((group, index) => {
        const folded = collapsed.includes(group.name);
        return (
          <View key={group.name} style={styles.group}>
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel={`${group.name}, đã chuẩn bị ${group.done}/${group.total} món`}
              accessibilityState={{ expanded: !folded }}
              onPress={() =>
                setCollapsed((names) => (folded ? names.filter((name) => name !== group.name) : [...names, group.name]))
              }
              style={({ pressed }) => [styles.groupHeader, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.tile, { backgroundColor: TILE_COLORS[index % TILE_COLORS.length] }]}>
                <Text style={styles.tileIcon}>{categoryIcon(group.name)}</Text>
              </View>
              <View style={ui.flex}>
                <Text accessibilityRole="header" style={typography.headline} numberOfLines={1}>
                  {group.name}
                </Text>
                <View style={styles.miniTrack}>
                  <View
                    style={[
                      styles.miniFill,
                      { width: `${group.total ? (group.done / group.total) * 100 : 0}%` },
                      group.done === group.total && { backgroundColor: colors.pinGreen },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.groupCount}>
                {group.done}/{group.total}
              </Text>
              <View style={[styles.chevron, !folded && styles.chevronOpen]}>
                <DesignIcon name="chevron" size={16} tintColor={colors.muted} />
              </View>
            </Pressable>
            {!folded && (
              <View style={styles.card}>
                {group.items.map((item, position) => {
                  const completed = item.status === "COMPLETED";
                  // Members may tick only their own or unassigned items, and undo only their own ticks.
                  const canComplete =
                    plan.permissions.can_complete &&
                    (editable || !item.assigned_member_id || item.assigned_member_id === me) &&
                    (!completed || editable || item.completed_by_user_id === trip.current_membership.user_id);
                  const who = assigneeLabel(item);
                  const isLate = !completed && !!item.due_at && overdue(item.due_at);
                  return (
                    <View key={item.id} style={[styles.item, position > 0 && styles.divider]}>
                      <Pressable
                        cssInterop={false}
                        accessibilityRole="button"
                        accessibilityLabel={`${completed ? "Bỏ hoàn thành" : "Hoàn thành"} ${item.name}`}
                        accessibilityState={{ checked: completed, disabled: !canComplete || command.busy }}
                        accessibilityHint={
                          canComplete ? undefined : "Chỉ người được phân công hoặc người tổ chức mới đánh dấu được món này."
                        }
                        disabled={!canComplete || command.busy}
                        hitSlop={6}
                        onPress={() => {
                          void complete(item);
                        }}
                        style={({ pressed }) => [styles.check, !canComplete && styles.checkLocked, pressed && { opacity: 0.6 }]}
                      >
                        <PackingCheck checked={completed} />
                      </Pressable>
                      <Pressable
                        cssInterop={false}
                        accessibilityRole={editable ? "button" : undefined}
                        accessibilityLabel={editable ? `Sửa ${item.name}` : undefined}
                        disabled={!editable || command.busy}
                        onPress={() => open(item)}
                        style={({ pressed }) => [styles.body, pressed && { opacity: 0.6 }]}
                      >
                        <Text style={[styles.name, completed && styles.nameDone]} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <View style={styles.meta}>
                          <Text style={styles.metaText}>{quantityLabel(item.quantity, item.unit)}</Text>
                          <Text style={styles.dot}>·</Text>
                          <View style={[styles.avatar, who === "Bạn" && styles.avatarMine]}>
                            {who === "Cả nhóm" ? (
                              <DesignIcon name="users" size={11} tintColor={colors.surface} />
                            ) : (
                              <Text style={styles.avatarText}>{who.slice(0, 1).toUpperCase()}</Text>
                            )}
                          </View>
                          <Text style={[styles.metaText, who === "Bạn" && styles.metaMine]} numberOfLines={1}>
                            {who}
                          </Text>
                          {item.due_at && (
                            <>
                              <Text style={styles.dot}>·</Text>
                              <Text style={[styles.metaText, isLate && styles.metaLate]}>
                                {isLate ? "Quá hạn " : "Hạn "}
                                {dateLabel(item.due_at, trip.timezone).slice(0, 5)}
                              </Text>
                            </>
                          )}
                        </View>
                        {!!item.note && (
                          <Text numberOfLines={1} style={styles.note}>
                            {item.note}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
                {editable && (
                  <Pressable
                    cssInterop={false}
                    accessibilityRole="button"
                    accessibilityLabel={`Thêm vào ${group.name}`}
                    disabled={command.busy || !membersReady}
                    onPress={() => open(undefined, group.name)}
                    style={({ pressed }) => [styles.addRow, pressed && { backgroundColor: colors.fill }]}
                  >
                    <DesignIcon name="plus" size={16} tintColor={colors.teal} />
                    <Text style={styles.addText}>Thêm vào {group.name}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        );
      })}

      <Sheet
        visible={!!form}
        title={form?.id ? "Sửa vật dụng" : "Thêm vật dụng"}
        dismissible={!command.busy}
        onClose={() => setForm(undefined)}
      >
        {form && (
          <>
            <FormField
              icon="bag"
              label="Tên vật dụng"
              value={form.name}
              onChangeText={(value) => change("name", value)}
              maxLength={200}
              placeholder="Ví dụ: Kem chống nắng"
              editable={!command.busy}
            />
            <View style={ui.row}>
              <View style={ui.flex}>
                <FormField
                  icon="edit"
                  label="Số lượng"
                  value={form.quantity}
                  onChangeText={(value) => change("quantity", value)}
                  keyboardType="decimal-pad"
                  maxLength={11}
                  editable={!command.busy}
                />
              </View>
              <View style={ui.flex}>
                <FormField
                  icon="edit"
                  label="Đơn vị"
                  value={form.unit}
                  onChangeText={(value) => change("unit", value)}
                  maxLength={30}
                  editable={!command.busy}
                />
              </View>
            </View>
            <Chips values={PACKING_UNITS} selected={form.unit} disabled={command.busy} onPress={(value) => change("unit", value)} />
            <Text style={styles.label}>Danh mục</Text>
            <View style={styles.options}>
              {[...new Set([...categories, form.category || "Khác"])].sort(categoryOrder).map((value) => {
                const active = newCategory === undefined && value === (form.category || "Khác");
                return (
                  <Pressable
                    cssInterop={false}
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`Chọn ${value}`}
                    accessibilityState={{ selected: active, disabled: command.busy }}
                    disabled={command.busy}
                    onPress={() => {
                      setNewCategory(undefined);
                      change("category", value);
                    }}
                    style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={[styles.optionText, active && styles.optionActiveText]}>
                      {categoryIcon(value)} {value}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                cssInterop={false}
                accessibilityRole="button"
                accessibilityLabel="Thêm danh mục mới"
                accessibilityState={{ selected: newCategory !== undefined, disabled: command.busy }}
                disabled={command.busy}
                onPress={() => setNewCategory((value) => value ?? "")}
                style={({ pressed }) => [
                  styles.option,
                  styles.optionNew,
                  newCategory !== undefined && styles.optionActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.optionText, { color: colors.teal }, newCategory !== undefined && styles.optionActiveText]}>
                  ＋ Danh mục mới
                </Text>
              </Pressable>
            </View>
            {newCategory !== undefined && (
              <FormField
                icon="edit"
                label="Tên danh mục mới"
                value={newCategory}
                onChangeText={(value) => {
                  setError(undefined);
                  setNewCategory(value);
                }}
                maxLength={CATEGORY_MAX}
                placeholder="Ví dụ: Đồ đi biển, Cắm trại"
                editable={!command.busy}
              />
            )}
            <Text style={styles.label}>Ai chuẩn bị?</Text>
            <Segments
              scroll
              value={form.assignee}
              items={[
                { value: "", label: "Cả nhóm" },
                ...members
                  .filter((member) => !member.left_at)
                  .map((member) => ({
                    value: member.id,
                    label: member.id === me ? "Tôi" : memberName(member, trip.current_membership.user_id),
                  })),
              ]}
              onChange={(value) => {
                if (!command.busy) change("assignee", value);
              }}
            />
            <DateTimeField
              label="Hạn chuẩn bị (không bắt buộc)"
              mode="date"
              value={form.due}
              onChangeText={(value) => change("due", value)}
              editable={!command.busy}
            />
            {!!form.due && (
              <Button label="Bỏ hạn chuẩn bị" variant="text" compact disabled={command.busy} onPress={() => change("due", "")} />
            )}
            <FormField
              icon="edit"
              label="Ghi chú"
              value={form.note}
              onChangeText={(value) => change("note", value)}
              maxLength={5000}
              multiline
              placeholder="Ví dụ: loại SPF 50, mua ở siêu thị gần nhà"
              editable={!command.busy}
            />
            {error && <Feedback message={error} />}
            {failure}
            <Button
              label="Lưu cho cả nhóm"
              loading={command.busy}
              disabled={!membersReady}
              onPress={() => {
                void save();
              }}
            />
            {form.id && (
              <Button
                label="Xóa vật dụng này"
                variant="text"
                compact
                disabled={command.busy}
                onPress={() => {
                  const item = items.find((entry) => entry.id === form.id);
                  command.clearError();
                  setForm(undefined);
                  setDeleting(item);
                }}
              />
            )}
          </>
        )}
      </Sheet>
      <Sheet visible={!!deleting} title="Xóa vật dụng?" dismissible={!command.busy} onClose={() => setDeleting(undefined)}>
        <Notice>{deleting?.name} sẽ được xóa khỏi danh sách chung của cả nhóm.</Notice>
        {failure}
        <Button
          label="Xóa vật dụng"
          variant="destructive"
          loading={command.busy}
          onPress={() => {
            void remove();
          }}
        />
        <Button label="Giữ lại" variant="soft" disabled={command.busy} onPress={() => setDeleting(undefined)} />
      </Sheet>
    </>
  );
}

function overdue(dueAt: string) {
  return Date.parse(dueAt) < Date.now();
}

function Chips({
  values,
  selected,
  disabled,
  onPress,
}: {
  values: readonly string[];
  selected: string;
  disabled: boolean;
  onPress: (value: string) => void;
}) {
  return (
    <View style={styles.options}>
      {values.map((value) => (
        <Pressable
          cssInterop={false}
          key={value}
          accessibilityRole="button"
          accessibilityLabel={`Chọn ${value}`}
          accessibilityState={{ selected: value === selected, disabled }}
          disabled={disabled}
          onPress={() => onPress(value)}
          style={({ pressed }) => [styles.option, value === selected && styles.optionActive, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.optionText, value === selected && styles.optionActiveText]}>{value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { padding: 18, gap: 12, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  summaryDone: { backgroundColor: colors.mintCanvas },
  count: { ...typography.title, fontVariant: ["tabular-nums"] },
  countTotal: { color: colors.muted, fontSize: 16 },
  ring: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  ringDone: { borderColor: colors.mint, backgroundColor: colors.surface },
  ringText: { color: colors.teal, fontFamily: fonts.bold, fontSize: 14, fontVariant: ["tabular-nums"] },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stat: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.fill,
    color: colors.ink,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  statMine: { backgroundColor: colors.tealSoft, color: colors.teal },
  statLate: { backgroundColor: colors.errorSurface, color: colors.error },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  filters: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filter: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.ink },
  filterText: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
  filterTextActive: { color: colors.surface },
  filterCount: { opacity: 0.6, fontVariant: ["tabular-nums"] },
  group: { gap: 8 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, minHeight: 44 },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tileIcon: { fontSize: 18 },
  miniTrack: { height: 4, marginTop: 4, borderRadius: 2, backgroundColor: colors.line, overflow: "hidden", maxWidth: 120 },
  miniFill: { height: 4, borderRadius: 2, backgroundColor: colors.teal },
  groupCount: { color: colors.muted, fontSize: 13, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  chevron: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  chevronOpen: { transform: [{ rotate: "90deg" }] },
  card: { borderRadius: radii.card, backgroundColor: colors.surface, overflow: "hidden", ...shadows.glass },
  item: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingRight: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line, marginLeft: 0 },
  check: { width: 56, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  checkLocked: { opacity: 0.45 },
  body: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 12 },
  name: { ...typography.headline },
  nameDone: { textDecorationLine: "line-through", color: colors.muted },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  metaText: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  metaMine: { color: colors.teal, fontFamily: fonts.bold },
  metaLate: { color: colors.error, fontFamily: fonts.bold },
  dot: { color: colors.line, fontSize: 13 },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  avatarMine: { backgroundColor: colors.teal },
  avatarText: { color: colors.surface, fontSize: 10, fontFamily: fonts.bold, lineHeight: 12 },
  note: { color: colors.muted, fontSize: 12, fontStyle: "italic" },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  addText: { color: colors.teal, fontSize: 14, fontFamily: fonts.bold },
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.bold },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  option: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.fill },
  optionNew: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.teal, backgroundColor: colors.surface },
  optionActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  optionText: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
  optionActiveText: { color: colors.surface },
});
