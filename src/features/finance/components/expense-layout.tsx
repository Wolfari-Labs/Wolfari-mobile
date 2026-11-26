import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, fonts, shadows } from "@/shared/theme/tokens";
import { ClayAmount, ClayChip, ClayDateField, ClayField, ClaySelect } from "@/shared/ui/clay-form";
import { Feedback } from "@/shared/ui/feedback";
import { Screen } from "@/shared/ui/screen";
import { ClayButton, ClayIcon, claySubtitle } from "@/shared/ui/setting-card";
import { EXPENSE_CATEGORIES } from "../expense-categories";
import { money } from "../model";

/** Figma D · M15. State, validation and upload stay in FinanceForm. */
export function ExpenseLayout({ title, values, set, available, recorder, error, disabled, photo, onChoosePhoto, onRemovePhoto, onSubmit, onClose }: {
  title: string; values: Record<string, string>; set: (key: string, value: string) => void;
  available: string; recorder: string; error?: string; disabled: boolean; photo?: string;
  onChoosePhoto: () => void; onRemovePhoto: () => void; onSubmit: () => void; onClose: () => void;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const amount = /^\d{1,19}$/.test(values.amount ?? "") ? BigInt(values.amount) : 0n;
  const left = BigInt(available) - amount;
  const custom = values.category && !EXPENSE_CATEGORIES.some(name => name === values.category) ? [values.category] : [];
  const close = () => { if (!disabled) onClose(); };
  return <Modal visible animationType={reduceMotion ? "none" : "slide"} onRequestClose={close} statusBarTranslucent>
    <Screen clay title={title} onBack={close} footer={<View style={styles.actions}>
      <View style={styles.cancel}><ClayButton tone="secondary" label="Hủy" disabled={disabled} onPress={close} /></View>
      <View style={styles.save}><ClayButton label="Lưu khoản chi" loading={disabled} onPress={() => { Keyboard.dismiss(); onSubmit(); }} /></View>
    </View>}>
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Số tiền</Text>
        <ClayAmount label="Số tiền (VND)" value={values.amount ?? ""} onChangeText={value => set("amount", value)} maxDigits={19} size={36} center editable={!disabled} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.chipScroll} contentContainerStyle={styles.chips}>
          {[...EXPENSE_CATEGORIES, ...custom].map(name => <ClayChip key={name} label={name} accessibilityLabel={`Danh mục ${name}`} selected={values.category === name} disabled={disabled}
            onPress={() => set("category", values.category === name ? "" : name)} />)}
        </ScrollView>
      </View>
      {error && <Feedback inline message={error} />}
      <ClayDateField label="Ngày chi" value={values.date ?? ""} onChangeText={value => set("date", value)} editable={!disabled} />
      <ClaySelect label="Người ghi nhận" value={recorder} icon="fieldUser" tone="lilac" />
      <ClayField label="Ghi chú" icon="fieldEdit" value={values.title ?? ""} onChangeText={value => set("title", value)} maxLength={200} placeholder="Ví dụ: Bữa trưa của cả nhóm" editable={!disabled} />
      {photo && <Image source={{ uri: photo }} style={styles.photo} contentFit="contain" cachePolicy="none" accessibilityLabel="Ảnh chứng từ đã chọn" />}
      <View style={styles.upload}>
        <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={photo ? "Đổi ảnh chứng từ" : "Đính kèm ảnh chứng từ"} accessibilityState={{ disabled }} disabled={disabled} onPress={onChoosePhoto}
          style={({ pressed }) => [styles.uploadTarget, (pressed || disabled) && { opacity: 0.6 }]}>
        <LinearGradient colors={["#7BA7FF", "#3C7BE8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.uploadIcon}><ClayIcon name="camera" size={20} /></LinearGradient>
        <View style={styles.flex}>
          <Text style={styles.uploadTitle}>{photo ? "Đổi ảnh hóa đơn" : "Thêm ảnh hóa đơn"}</Text>
          <Text style={claySubtitle}>Không bắt buộc · JPG, PNG · tối đa 10 MiB</Text>
        </View>
        </Pressable>
        {photo && <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Bỏ ảnh đã chọn" disabled={disabled} style={styles.removePhoto} onPress={onRemovePhoto}><ClayIcon name="x" size={16} /></Pressable>}
      </View>
      <View style={[styles.note, left < 0n && { backgroundColor: colors.errorSurface }]}>
        <ClayIcon name="info" size={18} />
        <Text style={styles.noteText}>
          {left < 0n ? `Quỹ khả dụng ${money(available)} · Còn thiếu ${money(String(-left))}` : `Chi từ quỹ nhóm ${money(String(amount))} · Khả dụng sau khi duyệt: ${money(String(left))}`}
        </Text>
      </View>
      <Text style={claySubtitle}>Khoản chi được lưu nháp. Quỹ sẽ trừ tiền khi người giữ quỹ xác nhận đã chi.</Text>
    </Screen>
  </Modal>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: "row", gap: 12 },
  cancel: { width: 120 },
  save: { flex: 1 },
  amountCard: { gap: 10, paddingVertical: 18, borderRadius: 32, backgroundColor: colors.surface, marginTop: -6, ...shadows.card },
  amountLabel: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: claySubtitle.color, textAlign: "center" },
  chipScroll: { marginVertical: -6 },
  chips: { flexGrow: 1, justifyContent: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 6 },
  photo: { width: "100%", height: 180 },
  upload: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.blue, backgroundColor: colors.surface },
  uploadTarget: { flex: 1, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  removePhoto: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  uploadIcon: { width: 40, height: 40, borderRadius: 13.6, alignItems: "center", justifyContent: "center", boxShadow: "0 5px 11px rgba(60,123,232,0.32), inset 0 2px 3px rgba(255,255,255,0.55)" },
  uploadTitle: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 22, color: colors.ink },
  note: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 12, paddingRight: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.mint },
  noteText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.ink },
});
