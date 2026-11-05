import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Progress, Segments, ui } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { PackingCheck } from "@/shared/ui/packing-check";
import {
  ConfirmSheet,
  DemoScreen,
  MemberBadge,
  MemberPicker,
  demoStyles as s,
} from "./components";
import { categories, type DemoPacking } from "./model";
import { useTripDemo } from "./provider";

export default function DemoPackingScreen() {
  const { state, send, nextId } = useTripDemo();
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<DemoPacking>();
  const [deleting, setDeleting] = useState<DemoPacking>();
  const [error, setError] = useState<string>();
  const done = state.packing.filter((p) => p.done).length;
  const visible = state.packing.filter(
    (p) =>
      (filter === "all" ||
        (filter === "mine" ? p.assignee === "mai" : !p.done)) &&
      (category === "all" || p.category === category),
  );
  function open(item?: DemoPacking) {
    setError(undefined);
    setEditing(
      item
        ? { ...item }
        : {
            id: nextId(),
            name: "",
            quantity: "1",
            unit: "cái",
            category: "Khác",
            assignee: "",
            note: "",
            done: false,
          },
    );
  }
  function save() {
    if (!editing) return;
    const failure = send({ type: "packing.save", value: editing });
    setError(failure);
    if (!failure) setEditing(undefined);
  }
  return (
    <DemoScreen
      title="Hành lý"
      intro={{ eyebrow: "CHUẨN BỊ CÙNG NHAU", title: "Gọn hành lý, nhẹ tâm trí" }}
      footer={
        <Button label="Thêm vật dụng mẫu" icon="plus" onPress={() => open()} />
      }
      summary={<>
        <View style={s.row}>
          <View style={ui.flex}>
            <Text style={typography.footnote}>Cả nhóm đã chuẩn bị</Text>
            <Text style={[typography.title, { fontVariant: ["tabular-nums"] }]}>
              {done}
              <Text style={s.subtle}> / {state.packing.length} món</Text>
            </Text>
          </View>
          <Text style={styles.remaining}>{state.packing.length - done} món còn lại</Text>
        </View>
        <Progress done={done} total={state.packing.length} />
        {!!state.packing.length && done === state.packing.length && <Text style={typography.footnote}>Mọi thứ đã sẵn sàng. Hẹn nhau lên đường!</Text>}
      </>}
    >
      <View style={styles.filters}>
      <Segments
        value={filter}
        onChange={setFilter}
        items={[
          { value: "all", label: "Cả nhóm" },
          { value: "mine", label: "Của Mai" },
          { value: "todo", label: "Chưa xong" },
        ]}
      />
      <Segments
        scroll
        value={category}
        onChange={setCategory}
        items={[
          { value: "all", label: "Tất cả" },
          ...categories.map((value) => ({ value, label: value })),
        ]}
      />
      </View>
      <View style={styles.list}>
      {categories
        .filter((c) => visible.some((p) => p.category === c))
        .map((group) => (
          <View key={group} style={styles.category}>
            <Text accessibilityRole="header" style={[typography.headline, styles.categoryTitle]}>
              {group} · {visible.filter((p) => p.category === group).length}
            </Text>
            {visible
              .filter((p) => p.category === group)
              .map((item) => (
                <View key={item.id} style={ui.record}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Đã chuẩn bị ${item.name}`}
                    accessibilityState={{ checked: item.done }}
                    onPress={() =>
                      send({ type: "packing.toggle", id: item.id })
                    }
                    style={styles.checkRow}
                  >
                    <PackingCheck checked={item.done} />
                    <View style={ui.flex}>
                      <Text
                        style={[
                          typography.headline,
                          item.done && styles.completed,
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={typography.footnote}>
                        {item.quantity} {item.unit} ·{" "}
                        {item.done ? "Đã chuẩn bị" : "Cần chuẩn bị"}
                      </Text>
                    </View>
                  </Pressable>
                  <MemberBadge id={item.assignee} suffix="phụ trách" />
                  {!!item.note && (
                    <Text style={typography.footnote}>{item.note}</Text>
                  )}
                  <View style={s.cardActions}>
                    <Button
                      label="Sửa"
                      accessibilityLabel={`Sửa ${item.name}`}
                      compact
                      variant="text"
                      onPress={() => open(item)}
                    />
                    <Button
                      label="Xóa"
                      accessibilityLabel={`Xóa ${item.name}`}
                      compact
                      variant="text"
                      onPress={() => setDeleting(item)}
                    />
                  </View>
                </View>
              ))}
          </View>
        ))}
      {!visible.length && (
        <EmptyState
          title="Danh sách đang trống"
          message="Đổi bộ lọc hoặc thêm vật dụng để chuẩn bị cho chuyến đi."
          icon="bag"
        />
      )}
      </View>
      <Sheet
        visible={!!editing}
        title="Chuẩn bị một vật dụng"
        onClose={() => setEditing(undefined)}
      >
        {editing && (
          <>
            <FormField
              label="Tên vật dụng"
              icon="bag"
              value={editing.name}
              maxLength={200}
              onChangeText={(name) => setEditing({ ...editing, name })}
              placeholder="Ví dụ: Áo khoác mỏng"
            />
            <View style={s.row}>
              {["Áo khoác", "Kính râm", "Bình nước"].map((name) => (
                <Button
                  key={name}
                  label={name}
                  compact
                  variant="soft"
                  onPress={() => setEditing({ ...editing, name })}
                />
              ))}
            </View>
            <FormField
              label="Số lượng"
              icon="bag"
              keyboardType="number-pad"
              maxLength={3}
              value={editing.quantity}
              onChangeText={(quantity) => setEditing({ ...editing, quantity })}
            />
            <FormField
              label="Đơn vị"
              icon="edit"
              maxLength={30}
              value={editing.unit}
              onChangeText={(unit) => setEditing({ ...editing, unit })}
            />
            <Text style={typography.headline}>Danh mục</Text>
            <Segments
              scroll
              value={editing.category}
              onChange={(category) => setEditing({ ...editing, category })}
              items={categories.map((value) => ({ value, label: value }))}
            />
            <MemberPicker
              optional
              value={editing.assignee}
              onChange={(assignee) => setEditing({ ...editing, assignee })}
            />
            <FormField
              label="Ghi chú vật dụng"
              icon="edit"
              multiline
              maxLength={500}
              value={editing.note}
              onChangeText={(note) => setEditing({ ...editing, note })}
            />
            {error && <Feedback message={error} />}
            <Button label="Lưu vật dụng mẫu" onPress={save} />
          </>
        )}
      </Sheet>
      <ConfirmSheet
        visible={!!deleting}
        title="Xóa vật dụng mẫu?"
        message={`Bỏ “${deleting?.name ?? ""}” khỏi danh sách mẫu. Dữ liệu thật không bị ảnh hưởng.`}
        label="Xác nhận xóa vật dụng"
        destructive
        onClose={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) send({ type: "packing.delete", id: deleting.id });
          setDeleting(undefined);
        }}
      />
    </DemoScreen>
  );
}
const styles = StyleSheet.create({
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
  },
  remaining: { ...typography.footnote, color: colors.tealPressed, fontWeight: "600" },
  filters: { gap: 4 },
  list: { gap: 24 },
  category: { gap: 0 },
  categoryTitle: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.tealSoft },
  completed: { color: colors.muted, textDecorationLine: "line-through" },
});
