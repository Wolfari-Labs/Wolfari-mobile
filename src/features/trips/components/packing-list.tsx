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
import { EmptyState, Notice, Progress, Segments, ui } from "@/shared/ui/journal";
import { PackingCheck } from "@/shared/ui/packing-check";
import { Sheet } from "@/shared/ui/sheet";
import type { useTrip } from "../hooks/use-trip";
import { memberName } from "../model/member-name";
import {
  PACKING_CATEGORIES,
  PACKING_UNITS,
  packingForm,
  packingInput,
  quantityLabel,
  type PackingForm,
} from "../model/packing";
import type { Membership, PackingItem, Plan, Trip } from "../types";
import { dateLabel } from "../utils";

export function PackingList({
  api,
  trip,
  plan,
  members,
  membersReady,
  reload,
  filter,
  category,
}: {
  api: ReturnType<typeof useTrip>["api"];
  trip: Trip;
  plan: Plan;
  members: Membership[];
  membersReady: boolean;
  reload(): Promise<unknown> | void;
  filter: "all" | "mine" | "todo";
  category: string;
}) {
  const command = useCommand();
  const [form, setForm] = useState<PackingForm>(),
    [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState<PackingItem>();
  const [saved, setSaved] = useState<string>();
  const rows = plan.packing_items.filter(
    (item) =>
      (category === "all" || (item.category || "Khác") === category) &&
      (filter === "all" ||
        (filter === "todo"
          ? item.status !== "COMPLETED"
          : item.assigned_member_id === trip.current_membership.id)),
  );
  const total = plan.packing_items.length;
  const done = plan.packing_items.filter((item) => item.status === "COMPLETED").length;
  const editable = plan.permissions.can_edit;
  const groups = [...new Set(rows.map((item) => item.category || "Khác"))]
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b, "vi"))
    .map((name) => {
      const items = rows
        .filter((item) => (item.category || "Khác") === name)
        // Unfinished first: the list reads as "what is left".
        .sort((a, b) => Number(a.status === "COMPLETED") - Number(b.status === "COMPLETED"));
      return { name, items, done: items.filter((item) => item.status === "COMPLETED").length };
    });
  function open(item?: PackingItem) {
    command.clearError();
    setError(undefined);
    setSaved(undefined);
    setForm(packingForm(item, trip.timezone));
  }
  const change = (field: keyof PackingForm, value: string) => {
    setError(undefined);
    setForm((old) => old && { ...old, [field]: value });
  };
  async function save() {
    if (!form || !membersReady || !editable) return;
    try {
      const input = packingInput(form, {
        members,
        timezone: trip.timezone,
        planVersion: plan.plan_version,
      });
      const result = await command.run({ id: form.id, ...input }, (key) =>
        api.trips.savePacking(trip.id, form.id, input, key),
      );
      if (result) {
        setForm(undefined);
        setSaved("Đã lưu vật dụng cho cả nhóm.");
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
    if (item.assigned_member_id === trip.current_membership.id) return "Bạn";
    const assignee = members.find((member) => member.id === item.assigned_member_id);
    return assignee ? memberName(assignee, trip.current_membership.user_id) : "Thành viên đã rời";
  };
  return (
    <>
      <View style={styles.summary}>
        <View style={ui.row}>
          <View style={ui.flex}>
            <Text style={typography.footnote}>Cả nhóm đã chuẩn bị</Text>
            <Text style={styles.count}>
              {done}
              <Text style={styles.countTotal}> / {total} món</Text>
            </Text>
          </View>
          <Text style={[styles.badge, total > 0 && done === total && styles.badgeDone]}>
            {!total ? "Chưa có đồ" : done === total ? "Đã đủ đồ" : `Còn ${total - done} món`}
          </Text>
        </View>
        {total > 0 && <Progress done={done} total={total} />}
      </View>
      {saved && <Feedback success message={saved} />}
      {!form && !deleting && failure}
      {editable && (
        <Button
          label="Thêm vật dụng"
          icon="plus"
          disabled={command.busy || !membersReady}
          onPress={() => open()}
        />
      )}
      {!rows.length && (
        <EmptyState
          title={total ? "Không có vật dụng phù hợp" : "Chưa có đồ cần mang"}
          message={
            total
              ? "Đổi bộ lọc hoặc danh mục để xem các món khác."
              : editable
                ? "Thêm những món cả nhóm cần mang, phân công người chuẩn bị và đặt hạn."
                : "Người tổ chức sẽ thêm danh sách đồ cần mang cho chuyến đi."
          }
          icon="bag"
        />
      )}
      {groups.map((group) => (
        <View key={group.name} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text accessibilityRole="header" style={[typography.headline, ui.flex]}>
              {group.name}
            </Text>
            <Text style={styles.groupCount}>
              {group.done}/{group.items.length}
            </Text>
          </View>
          {group.items.map((item) => {
            const completed = item.status === "COMPLETED";
            // Members may tick only their own or unassigned items, and undo only their own ticks.
            const canComplete =
              plan.permissions.can_complete &&
              (editable ||
                !item.assigned_member_id ||
                item.assigned_member_id === trip.current_membership.id) &&
              (!completed ||
                editable ||
                item.completed_by_user_id === trip.current_membership.user_id);
            const mine = item.assigned_member_id === trip.current_membership.id;
            return (
              <View key={item.id} style={[styles.item, completed && styles.itemDone]}>
                <Pressable
                  cssInterop={false}
                  accessibilityRole="button"
                  accessibilityLabel={`${completed ? "Bỏ hoàn thành" : "Hoàn thành"} ${item.name}`}
                  accessibilityState={{ checked: completed, disabled: !canComplete || command.busy }}
                  accessibilityHint={canComplete ? undefined : "Chỉ người được phân công hoặc người tổ chức mới đánh dấu được món này."}
                  disabled={!canComplete || command.busy}
                  onPress={() => {
                    void complete(item);
                  }}
                  style={({ pressed }) => [styles.check, !canComplete && styles.checkLocked, pressed && { opacity: 0.6 }]}
                >
                  <PackingCheck checked={completed} />
                </Pressable>
                <View style={styles.body}>
                  <Text style={[typography.headline, completed && styles.nameDone]}>{item.name}</Text>
                  <View style={styles.chips}>
                    <Text style={styles.chip}>{quantityLabel(item.quantity, item.unit)}</Text>
                    <View style={[styles.chip, styles.person, mine && styles.personMine]}>
                      <Text style={styles.avatar}>{assigneeLabel(item).slice(0, 1).toUpperCase()}</Text>
                      <Text style={styles.chipText} numberOfLines={1}>{assigneeLabel(item)}</Text>
                    </View>
                    {item.due_at && (
                      <Text style={[styles.chip, !completed && overdue(item.due_at) && styles.late]}>
                        Hạn {dateLabel(item.due_at, trip.timezone).slice(0, 5)}
                      </Text>
                    )}
                  </View>
                  {!!item.note && (
                    <Text numberOfLines={2} style={typography.footnote}>
                      {item.note}
                    </Text>
                  )}
                </View>
                {editable && (
                  <View style={styles.tools}>
                    <Pressable
                      cssInterop={false}
                      accessibilityRole="button"
                      accessibilityLabel={`Sửa ${item.name}`}
                      disabled={command.busy}
                      onPress={() => open(item)}
                      style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.fill }]}
                    >
                      <DesignIcon name="edit" size={18} tintColor={colors.ink} />
                    </Pressable>
                    <Pressable
                      cssInterop={false}
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa ${item.name}`}
                      disabled={command.busy}
                      onPress={() => {
                        command.clearError();
                        setDeleting(item);
                      }}
                      style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.errorSurface }]}
                    >
                      <Text style={styles.remove}>✕</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
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
            <Chips
              values={PACKING_UNITS}
              selected={form.unit}
              disabled={command.busy}
              onPress={(value) => change("unit", value)}
            />
            <Text style={styles.label}>Danh mục</Text>
            <Chips
              values={[...new Set([...PACKING_CATEGORIES, form.category || "Khác"])]}
              selected={form.category || "Khác"}
              disabled={command.busy}
              onPress={(value) => change("category", value)}
            />
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
                    label: member.id === trip.current_membership.id ? "Tôi" : memberName(member, trip.current_membership.user_id),
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
              <Button
                label="Bỏ hạn chuẩn bị"
                variant="text"
                compact
                disabled={command.busy}
                onPress={() => change("due", "")}
              />
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
          </>
        )}
      </Sheet>
      <Sheet
        visible={!!deleting}
        title="Xóa vật dụng?"
        dismissible={!command.busy}
        onClose={() => setDeleting(undefined)}
      >
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

function order(category: string) {
  const index = PACKING_CATEGORIES.indexOf(category);
  return index < 0 ? PACKING_CATEGORIES.length - 1 : index;
}

function overdue(dueAt: string) {
  return Date.parse(dueAt) < Date.now();
}

function Chips({ values, selected, disabled, onPress }: {
  values: readonly string[];
  selected: string;
  disabled: boolean;
  onPress: (value: string) => void;
}) {
  return (
    <View style={styles.chips}>
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
          <Text style={[styles.chipText, value === selected && styles.optionActiveText]}>{value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { padding: 16, gap: 12, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  count: { ...typography.title, fontVariant: ["tabular-nums"] },
  countTotal: { color: colors.muted, fontSize: 16 },
  badge: {
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.butter,
    color: colors.ink,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  badgeDone: { backgroundColor: colors.mint, color: colors.pinGreen },
  group: { gap: 8 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  groupCount: { color: colors.muted, fontSize: 13, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 72,
    paddingVertical: 8,
    paddingRight: 6,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.glass,
  },
  itemDone: { opacity: 0.62 },
  check: { width: 56, minHeight: 56, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  checkLocked: { opacity: 0.45 },
  body: { flex: 1, minWidth: 0, gap: 6, paddingVertical: 4 },
  nameDone: { textDecorationLine: "line-through", color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.fill,
    color: colors.ink,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  chipText: { color: colors.ink, fontSize: 12, fontFamily: fonts.bold, flexShrink: 1 },
  person: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, maxWidth: 180 },
  personMine: { backgroundColor: colors.tealSoft },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 18,
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.surface,
    backgroundColor: colors.teal,
  },
  late: { backgroundColor: colors.errorSurface, color: colors.error },
  tools: { gap: 2 },
  tool: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  remove: { color: colors.error, fontSize: 16, fontFamily: fonts.bold },
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.bold },
  option: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.fill },
  optionActive: { backgroundColor: colors.teal },
  optionActiveText: { color: colors.surface },
});
