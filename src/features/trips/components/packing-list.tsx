import { errorMessage } from "@/shared/api/errors";
import { useState } from "react";
import { Text, View } from "react-native";
import { useCommand } from "@/shared/hooks/use-command";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Notice, Progress, Segments, ui } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import type { useTrip } from "../hooks/use-trip";
import { memberName } from "../model/member-name";
import { packingForm, packingInput, type PackingForm } from "../model/packing";
import type { Membership, PackingItem, Plan, Trip } from "../types";
import { dateLabel } from "../utils";
import { PackingCompletion } from "./packing-completion";

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
  const [saved, setSaved] = useState<string>(),
    [celebrate, setCelebrate] = useState(false);
  const rows = plan.packing_items.filter(
    (item) =>
      (category === "all" || (item.category || "Khác") === category) &&
      (filter === "all" ||
        (filter === "todo"
          ? item.status !== "COMPLETED"
          : item.assigned_member_id === trip.current_membership.id)),
  );
  const done = plan.packing_items.filter((item) => item.status === "COMPLETED").length;
  const editable = plan.permissions.can_edit;
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
  return (
    <>
      <Text style={typography.headline}>
        Cả nhóm đã chuẩn bị {done}/{plan.packing_items.length}
      </Text>
      <Progress done={done} total={plan.packing_items.length} />
      {!!plan.packing_items.length && done === plan.packing_items.length && (
        <Button label="Danh sách đã sẵn sàng!" onPress={() => setCelebrate(true)} />
      )}
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
          title="Chưa có vật dụng ở danh sách này"
          message="Danh sách đã lưu sẽ được chia sẻ cùng chuyến đi."
        />
      )}
      {rows.map((item) => {
        const assignee = members.find((member) => member.id === item.assigned_member_id);
        const canComplete =
          plan.permissions.can_complete &&
          (editable ||
            !item.assigned_member_id ||
            item.assigned_member_id === trip.current_membership.id) &&
          (item.status !== "COMPLETED" ||
            editable ||
            item.completed_by_user_id === trip.current_membership.user_id);
        return (
          <View key={item.id} style={ui.record}>
            <Text style={typography.headline}>{item.name}</Text>
            <Text style={typography.body}>
              {item.quantity} {item.unit} ·{" "}
              {item.status === "COMPLETED" ? "Đã chuẩn bị" : "Chưa chuẩn bị"}
            </Text>
            <Text style={typography.footnote}>
              {item.category || "Khác"} ·{" "}
              {item.assigned_member_id
                ? assignee
                  ? memberName(assignee, trip.current_membership.user_id)
                  : "Thành viên đã rời"
                : "Cả nhóm"}
            </Text>
            {item.due_at && (
              <Text style={typography.footnote}>Hạn: {dateLabel(item.due_at, trip.timezone)}</Text>
            )}
            {!!item.note && <Text style={typography.body}>{item.note}</Text>}
            <View style={ui.actionRow}>
              {canComplete && (
                <Button
                  compact
                  variant="soft"
                  label={item.status === "COMPLETED" ? "Chưa chuẩn bị" : "Đã chuẩn bị"}
                  accessibilityLabel={`${item.status === "COMPLETED" ? "Bỏ hoàn thành" : "Hoàn thành"} ${item.name}`}
                  disabled={command.busy}
                  onPress={() => {
                    void complete(item);
                  }}
                />
              )}
              {editable && (
                <>
                  <Button
                    compact
                    variant="soft"
                    label="Sửa"
                    accessibilityLabel={`Sửa ${item.name}`}
                    disabled={command.busy}
                    onPress={() => open(item)}
                  />
                  <Button
                    compact
                    variant="destructive"
                    label="Xóa"
                    accessibilityLabel={`Xóa ${item.name}`}
                    disabled={command.busy}
                    onPress={() => {
                      command.clearError();
                      setDeleting(item);
                    }}
                  />
                </>
              )}
            </View>
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
              icon="edit"
              label="Tên vật dụng"
              value={form.name}
              onChangeText={(value) => change("name", value)}
              maxLength={200}
              editable={!command.busy}
            />
            <FormField
              icon="edit"
              label="Số lượng"
              value={form.quantity}
              onChangeText={(value) => change("quantity", value)}
              keyboardType="decimal-pad"
              maxLength={11}
              editable={!command.busy}
            />
            <FormField
              icon="edit"
              label="Đơn vị"
              value={form.unit}
              onChangeText={(value) => change("unit", value)}
              maxLength={30}
              editable={!command.busy}
            />
            <FormField
              icon="edit"
              label="Danh mục"
              value={form.category}
              onChangeText={(value) => change("category", value)}
              maxLength={80}
              editable={!command.busy}
            />
            <Text style={typography.headline}>Phân công</Text>
            <Segments
              scroll
              value={form.assignee}
              items={[
                { value: "", label: "Cả nhóm" },
                ...members
                  .filter((member) => !member.left_at)
                  .map((member) => ({
                    value: member.id,
                    label: memberName(member, trip.current_membership.user_id),
                  })),
              ]}
              onChange={(value) => {
                if (!command.busy) change("assignee", value);
              }}
            />
            <DateTimeField
              label="Hạn chuẩn bị"
              mode="date"
              value={form.due}
              onChangeText={(value) => change("due", value)}
              editable={!command.busy}
            />
            {!!form.due && (
              <Button
                label="Bỏ hạn chuẩn bị"
                variant="text"
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
        <Notice>{deleting?.name} sẽ được xóa khỏi danh sách chung.</Notice>
        {failure}
        <Button
          label="Xóa vật dụng"
          variant="destructive"
          loading={command.busy}
          onPress={() => {
            void remove();
          }}
        />
      </Sheet>
      <PackingCompletion visible={celebrate} count={done} onClose={() => setCelebrate(false)} />
    </>
  );
}
