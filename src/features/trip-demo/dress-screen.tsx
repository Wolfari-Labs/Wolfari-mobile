import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Segments } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { GlassSurface } from "@/shared/ui/glass-surface";
import { ConfirmSheet, DemoScreen, demoStyles as s } from "./components";
import { demoActivities, demoDays, palettes, type DemoDress } from "./model";
import { useTripDemo } from "./provider";

const scopes = [
  { value: "TRIP", label: "Cả chuyến" },
  { value: "DAY", label: "Theo ngày" },
  { value: "ACTIVITY", label: "Hoạt động" },
] as const;
export default function DemoDressScreen() {
  const { state, send, nextId } = useTripDemo();
  const [filter, setFilter] = useState("ALL");
  const [editing, setEditing] = useState<DemoDress>();
  const [deleting, setDeleting] = useState<DemoDress>();
  const [error, setError] = useState<string>();
  const visible = state.dress.filter(
    (d) => filter === "ALL" || d.scope === filter,
  );
  function open(item?: DemoDress) {
    setError(undefined);
    setEditing(
      item
        ? { ...item }
        : {
            id: nextId(),
            label: "",
            scope: "TRIP",
            day: demoDays[0],
            activity: demoActivities[0].id,
            palette: "coast",
            description: "",
          },
    );
  }
  function save() {
    if (!editing) return;
    const failure = send({ type: "dress.save", value: editing });
    setError(failure);
    if (!failure) setEditing(undefined);
  }
  return (
    <DemoScreen
      title="Dress code"
      intro={{ eyebrow: "CÙNG DIỆN, CÙNG ĐẸP", title: "Những gam màu của chúng mình", subtitle: "Một chút đồng điệu cho những tấm hình muốn giữ mãi.", icon: "shirt", tone: "sand" }}
      footer={
        <Button
          label="Thêm dress code mẫu"
          icon="plus"
          onPress={() => open()}
        />
      }
    >
      <Segments
        scroll
        value={filter}
        onChange={setFilter}
        items={[{ value: "ALL", label: "Tất cả" }, ...scopes]}
      />
      {visible.map((code) => {
        const palette = palettes.find((p) => p.id === code.palette)!;
        const activity = demoActivities.find((a) => a.id === code.activity);
        const scopeLabel =
          code.scope === "TRIP"
            ? "Cả hành trình"
            : code.scope === "DAY"
              ? code.day
              : `${activity?.title} · ${activity?.day}`;
        return (
          <View key={code.id} style={styles.card}>
            <View
              style={[
                styles.paletteHero,
                { backgroundColor: palette.colors[2] },
              ]}
            >
              <View style={styles.swatches}>
                {palette.colors.map((color) => (
                  <View
                    key={color}
                    style={[styles.swatch, { backgroundColor: color }]}
                  />
                ))}
              </View>
              <DesignIcon
                name="shirt"
                size={50}
                tintColor={palette.id === "mono" ? colors.ink : "#576B6B"}
              />
            </View>
            <View style={styles.body}>
              <GlassSurface variant="regular" style={styles.scope}>
                <Text style={[s.label, { color: colors.tealPressed }]}>
                  {scopeLabel}
                </Text>
              </GlassSurface>
              <Text accessibilityRole="header" style={typography.section}>
                {code.label}
              </Text>
              <Text style={typography.headline}>{palette.name}</Text>
              <Text style={s.subtle}>
                {code.description ||
                  "Chọn trang phục thoải mái theo bảng màu gợi ý."}
              </Text>
              <View style={s.cardActions}>
                <Button
                  label="Sửa"
                  accessibilityLabel={`Sửa ${code.label}`}
                  compact
                  variant="text"
                  onPress={() => open(code)}
                />
                <Button
                  label="Xóa"
                  accessibilityLabel={`Xóa ${code.label}`}
                  compact
                  variant="text"
                  onPress={() => setDeleting(code)}
                />
              </View>
            </View>
          </View>
        );
      })}
      {!visible.length && (
        <EmptyState
          title="Chưa có dress code ở đây"
          message="Thêm một ý tưởng phối đồ hoặc xem các phạm vi khác."
          icon="shirt"
        />
      )}
      <Sheet
        visible={!!editing}
        title="Lên ý tưởng dress code"
        onClose={() => setEditing(undefined)}
      >
        {editing && (
          <>
            <FormField
              label="Tên dress code"
              icon="shirt"
              value={editing.label}
              maxLength={100}
              onChangeText={(label) => setEditing({ ...editing, label })}
              placeholder="Ví dụ: Một chiều bên biển"
            />
            <Text style={typography.headline}>Áp dụng cho</Text>
            <Segments
              scroll
              value={editing.scope}
              onChange={(scope) =>
                setEditing({
                  ...editing,
                  scope,
                  day: editing.day || demoDays[0],
                  activity: editing.activity || demoActivities[0].id,
                })
              }
              items={[...scopes]}
            />
            {editing.scope === "DAY" && (
              <>
                <Text style={typography.headline}>Ngày mặc</Text>
                <Segments
                  scroll
                  value={editing.day}
                  onChange={(day) => setEditing({ ...editing, day })}
                  items={demoDays.map((value, index) => ({
                    value,
                    label: `Ngày ${index + 1} · ${value.slice(0, 5)}`,
                  }))}
                />
              </>
            )}
            {editing.scope === "ACTIVITY" && (
              <>
                <Text style={typography.headline}>Hoạt động</Text>
                <Segments
                  scroll
                  value={editing.activity}
                  onChange={(activity) => setEditing({ ...editing, activity })}
                  items={demoActivities.map((a) => ({
                    value: a.id,
                    label: a.title,
                  }))}
                />
              </>
            )}
            <Text style={typography.headline}>Chọn bảng màu</Text>
            <View style={styles.paletteGrid}>
              {palettes.map((palette) => (
                <Pressable
                  key={palette.id}
                  accessibilityRole="radio"
                  accessibilityLabel={palette.name}
                  accessibilityState={{
                    checked: editing.palette === palette.id,
                  }}
                  onPress={() =>
                    setEditing({ ...editing, palette: palette.id })
                  }
                  style={[
                    styles.paletteOption,
                    editing.palette === palette.id && styles.selected,
                  ]}
                >
                  <View style={s.row}>
                    {palette.colors.map((color) => (
                      <View
                        key={color}
                        style={[styles.smallSwatch, { backgroundColor: color }]}
                      />
                    ))}
                  </View>
                  <Text style={typography.footnote}>
                    {palette.name}
                    {editing.palette === palette.id ? " ✓" : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
            <FormField
              label="Gợi ý trang phục"
              icon="edit"
              multiline
              maxLength={500}
              value={editing.description}
              onChangeText={(description) =>
                setEditing({ ...editing, description })
              }
            />
            {error && <Feedback message={error} />}
            <Button label="Lưu dress code mẫu" onPress={save} />
          </>
        )}
      </Sheet>
      <ConfirmSheet
        visible={!!deleting}
        title="Xóa dress code mẫu?"
        message={`Bỏ ý tưởng “${deleting?.label ?? ""}” khỏi chuyến đi mẫu?`}
        label="Xác nhận xóa dress code"
        destructive
        onClose={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) send({ type: "dress.delete", id: deleting.id });
          setDeleting(undefined);
        }}
      />
    </DemoScreen>
  );
}
const styles = StyleSheet.create({
  card: {
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  paletteHero: {
    borderRadius: 12,
    minHeight: 150,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  swatches: { flexDirection: "row", paddingLeft: 8 },
  swatch: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.surface,
    marginLeft: -8,
  },
  body: { paddingHorizontal: 4, gap: 10 },
  scope: { alignSelf: "flex-start", marginTop: -18, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  paletteGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  paletteOption: {
    flexGrow: 1,
    flexBasis: 135,
    padding: 12,
    gap: 10,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 16,
  },
  selected: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  smallSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#B7BDC1",
  },
});
