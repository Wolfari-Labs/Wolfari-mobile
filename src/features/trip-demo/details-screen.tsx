import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useNavigation } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { Segments, ui } from "@/shared/ui/journal";
import { ConfirmSheet, DemoScreen, Stat, demoStyles as s } from "./components";
import { formatMoney, type TripDetails } from "./model";
import { useTripDemo } from "./provider";

const covers = [
  { id: "tripCover", label: "Đà Nẵng" },
  { id: "dalat", label: "Đà Lạt" },
  { id: "coast", label: "Bên biển" },
] as const;
export default function DemoDetailsScreen() {
  const { state, send, releaseUnusedCover } = useTripDemo();
  const [form, setForm] = useState({ ...state.details });
  const [error, setError] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [discardAction, setDiscardAction] = useState<NavigationAction>();
  const [saved, setSaved] = useState(false);
  const navigation = useNavigation();
  const pickGuard = useRef(false);
  const mounted = useRef(true);
  const dirty = JSON.stringify(form) !== JSON.stringify(state.details);
  // Guard navigator removals too: Android Back, iOS gestures and parent pops.
  usePreventRemove(dirty && !saved, ({ data }) => setDiscardAction(data.action));
  // Wait for the save and the removal guard to commit before leaving. Trimming
  // fields in the model can otherwise make a successful save still look dirty.
  useEffect(() => {
    if (saved) router.dismissTo("/demo-trip");
  }, [saved]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const uri = form.coverUri;
    // Saving transfers ownership to the provider; replacing/discarding a draft
    // releases only its unsaved object URL.
    return () => releaseUnusedCover(uri);
  }, [form.coverUri, releaseUnusedCover]);
  const update = <K extends keyof TripDetails>(key: K, value: TripDetails[K]) =>
    setForm((old) => ({ ...old, [key]: value }));
  async function chooseCover() {
    if (pickGuard.current) return;
    pickGuard.current = true;
    setPicking(true);
    setError(undefined);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!mounted.current) {
        releaseUnusedCover(asset?.uri);
        return;
      }
      if (
        !asset ||
        !asset.fileSize ||
        asset.fileSize > 5 * 1024 * 1024 ||
        asset.width * asset.height > 40_000_000 ||
        !["image/jpeg", "image/png", "image/webp"].includes(
          asset.mimeType ?? "",
        )
      ) {
        releaseUnusedCover(asset?.uri);
        setError("Chọn ảnh JPEG, PNG hoặc WebP tối đa 5 MB và 40 megapixel.");
        return;
      }
      update("coverUri", asset.uri);
    } catch {
      if (mounted.current)
        setError("Chưa mở được thư viện ảnh. Bạn vẫn có thể dùng ảnh bìa mẫu.");
    } finally {
      pickGuard.current = false;
      if (mounted.current) setPicking(false);
    }
  }
  function save() {
    if (pickGuard.current || saved) return;
    const failure = send({ type: "details", value: form });
    setError(failure);
    if (!failure) setSaved(true);
  }
  return (
    <DemoScreen
      title="Thông tin chuyến đi"
      onBack={() => router.dismissTo("/demo-trip")}
      footer={
        <Button
          label="Lưu chuyến đi mẫu"
          disabled={picking || saved}
          onPress={save}
        />
      }
    >
      <Text style={s.eyebrow}>HÀNH TRÌNH CỦA CHÚNG MÌNH</Text>
      <Text accessibilityRole="header" style={s.heading}>
        Một chuyến đi, một dấu ấn
      </Text>
      <Image
        source={
          form.coverUri ? { uri: form.coverUri } : designAssets[form.cover]
        }
        contentFit="cover"
        style={styles.hero}
        accessibilityLabel="Xem trước ảnh bìa"
      />
      <View style={s.row}>
        {covers.map((cover) => (
          <Pressable
            key={cover.id}
            accessibilityRole="radio"
            accessibilityLabel={`Ảnh bìa ${cover.label}`}
            accessibilityState={{
              checked: !form.coverUri && form.cover === cover.id,
            }}
            onPress={() =>
              setForm((old) => ({
                ...old,
                cover: cover.id,
                coverUri: undefined,
              }))
            }
            style={[
              styles.cover,
              !form.coverUri && form.cover === cover.id && styles.selected,
            ]}
          >
            <Image
              source={designAssets[cover.id]}
              contentFit="cover"
              style={styles.thumbnail}
            />
            <Text style={styles.coverLabel}>{cover.label}</Text>
          </Pressable>
        ))}
      </View>
      <Button
        label="Chọn ảnh từ thiết bị"
        variant="soft"
        loading={picking}
        onPress={() => {
          void chooseCover();
        }}
      />
      <Text style={typography.footnote}>
        Ảnh chỉ dùng trong phiên xem mẫu, không tải lên. Không chọn giấy tờ hoặc
        ảnh có thông tin nhạy cảm.
      </Text>
      <FormField
        label="Tên chuyến đi mẫu"
        icon="trip"
        value={form.name}
        onChangeText={(value) => update("name", value)}
        maxLength={200}
      />
      <FormField
        label="Điểm đến"
        icon="pin"
        value={form.destination}
        onChangeText={(value) => update("destination", value)}
        maxLength={200}
      />
      <View style={s.row}>
        {["Đà Nẵng · Hội An", "Đà Lạt", "Phú Quốc"].map((value) => (
          <Button
            key={value}
            compact
            variant="soft"
            label={value}
            onPress={() => update("destination", value)}
          />
        ))}
      </View>
      <View style={[ui.card, { backgroundColor: colors.tealSoft }]}>
        <Text style={typography.headline}>12 — 14/11/2026 · 3 ngày, 2 đêm</Text>
        <Text style={typography.footnote}>
          Lịch cố định của bản mẫu, dùng chung với dress code và hoạt động.
        </Text>
      </View>
      <FormField
        label="Ngân sách cả chuyến (VND)"
        icon="wallet"
        keyboardType="number-pad"
        value={form.budget}
        onChangeText={(value) => update("budget", value)}
        maxLength={12}
      />
      <FormField
        label="Số người dự kiến"
        icon="users"
        keyboardType="number-pad"
        value={form.travelers}
        onChangeText={(value) => update("travelers", value)}
        maxLength={2}
      />
      {/^[1-9]\d{0,11}$/.test(form.budget) &&
        /^([1-9]|1\d|20)$/.test(form.travelers) && (
          <Stat
            label="Ước tính mỗi người"
            value={formatMoney(
              Math.ceil(Number(form.budget) / Number(form.travelers)),
            )}
            accent
          />
        )}
      <Text style={typography.footnote}>
        Ngân sách là mục tiêu dự kiến, không phải số dư quỹ. Số người dự kiến
        không thêm/xóa thành viên mẫu.
      </Text>
      <Text style={typography.headline}>Phong cách chuyến đi</Text>
      <Segments
        value={form.style}
        onChange={(value) => update("style", value)}
        items={[
          { value: "explore", label: "Khám phá" },
          { value: "relax", label: "Nghỉ dưỡng" },
          { value: "food", label: "Ẩm thực" },
        ]}
      />
      <FormField
        label="Lời nhắn cho nhóm"
        icon="edit"
        multiline
        value={form.description}
        onChangeText={(value) => update("description", value)}
        maxLength={1000}
      />
      {error && <Feedback message={error} />}
      <Button
        label="Hủy chỉnh sửa"
        variant="soft"
        onPress={() => router.dismissTo("/demo-trip")}
      />
      <ConfirmSheet
        visible={!!discardAction}
        title="Bỏ thay đổi chưa lưu?"
        message="Thông tin bạn vừa nhập và ảnh vừa chọn chưa được áp dụng vào chuyến đi mẫu."
        label="Bỏ chỉnh sửa"
        destructive
        onClose={() => setDiscardAction(undefined)}
        onConfirm={() => {
          if (!discardAction) return;
          setDiscardAction(undefined);
          navigation.dispatch(discardAction);
        }}
      />
    </DemoScreen>
  );
}
const styles = StyleSheet.create({
  hero: { width: "100%", height: 180, borderRadius: 24 },
  cover: {
    flex: 1,
    minWidth: 80,
    padding: 4,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.teal },
  thumbnail: { width: "100%", height: 64, borderRadius: 10 },
  coverLabel: {
    ...typography.footnote,
    color: colors.ink,
    textAlign: "center",
    paddingVertical: 7,
  },
});
