import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { PaymentQrCamera } from "@/features/payments/components/payment-qr-camera";
import { MAX_PAYMENT_QR_LENGTH, parsePaymentQr, type PaymentQr } from "@/features/payments/model/payment-qr";
import { readQrFromImage } from "@/features/payments/model/qr-image";
import { colors, fonts, pastelTones, shadows } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DesignIcon } from "@/shared/ui/design-icon";
import type { DesignIconName } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";

type Mode = "menu" | "camera" | "paste";

/**
 * Reads a receiving account's VietQR on device to pre-fill form fields: by camera, from a picture
 * already on the phone (a screenshot from the bank app), or from pasted text.
 * Nothing is stored or sent here; the user still reviews every field before submitting.
 */
export function QrFill({ onRead, onBusy, disabled = false }: {
  onRead(payment: PaymentQr): string | undefined;
  /** True while the camera or the paste box is open, so the form can hold its submit button. */
  onBusy?(busy: boolean): void;
  disabled?: boolean;
}) {
  const [mode, setModeState] = useState<Mode>("menu");
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [picking, setPicking] = useState(false);
  const setMode = (next: Mode) => { setModeState(next); setRaw(""); onBusy?.(next !== "menu"); };
  function read(value: string) {
    Keyboard.dismiss();
    const result = parsePaymentQr(value);
    const problem = result.ok ? onRead(result.payment) : result.message;
    if (problem) { setError(problem); setAttempt(n => n + 1); return; }
    setError(undefined);
    setMode("menu");
  }
  async function fromImage() {
    if (picking || disabled) return;
    setPicking(true);
    setError(undefined);
    try {
      const data = await readQrFromImage();
      if (data) read(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đọc được ảnh QR.");
    } finally { setPicking(false); }
  }
  return <View style={styles.card}>
    <View style={styles.head}>
      <LinearGradient colors={pastelTones.blue.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
        <DesignIcon name="wallet" size={20} tintColor={colors.surface} />
      </LinearGradient>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>Điền nhanh từ mã QR</Text>
        <Text style={styles.sub}>Dùng mã QR nhận tiền trong app ngân hàng của người giữ quỹ.</Text>
      </View>
    </View>
    {error && <Feedback message={error} />}
    {mode === "menu" ? <>
      <View style={styles.tiles}>
        <Tile icon="camera" title="Quét bằng camera" text="Mở mã trên máy khác" disabled={disabled} onPress={() => { setError(undefined); setMode("camera"); }} />
        <Tile icon="file" title="Chọn ảnh QR" text="Ảnh chụp màn hình trong máy" busy={picking} disabled={disabled} onPress={() => { void fromImage(); }} />
      </View>
      <Pressable cssInterop={false} accessibilityRole="button" disabled={disabled} onPress={() => { setError(undefined); setMode("paste"); }}
        style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
        <Text style={styles.linkText}>Hoặc dán nội dung mã (000201…)</Text>
      </Pressable>
    </> : mode === "camera" ? <>
      <PaymentQrCamera key={attempt} onScan={read} />
      <Button label="Đóng camera" variant="text" compact onPress={() => setMode("menu")} />
    </> : <>
      <FormField label="Nội dung VietQR (000201…)" icon="wallet" multiline value={raw} onChangeText={setRaw}
        autoCapitalize="none" autoCorrect={false} maxLength={MAX_PAYMENT_QR_LENGTH + 1} placeholder="000201..." />
      <Button label="Đọc và điền thông tin" disabled={!raw.trim()} onPress={() => read(raw)} />
      <Button label="Quay lại" variant="text" compact onPress={() => setMode("menu")} />
    </>}
    <Text style={styles.note}>Mã chỉ được đọc trên máy để điền ngân hàng, số tài khoản và tên. Tên trong QR chưa được ngân hàng xác minh.</Text>
  </View>;
}

function Tile({ icon, title, text, busy, disabled, onPress }: { icon: DesignIconName; title: string; text: string; busy?: boolean; disabled?: boolean; onPress(): void }) {
  return <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={text}
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, (disabled || busy) && { opacity: 0.6 }]}>
    <View style={styles.tileIcon}><DesignIcon name={icon} size={24} tintColor={colors.blue} /></View>
    <Text style={styles.tileTitle}>{busy ? "Đang đọc ảnh…" : title}</Text>
    <Text style={styles.tileText}>{text}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { gap: 14, padding: 16, borderRadius: 26, borderCurve: "continuous", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 21, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  tiles: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, minHeight: 112, gap: 6, padding: 14, borderRadius: 22, borderCurve: "continuous", backgroundColor: colors.fill, ...shadows.glass },
  tileIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.tealSoft },
  tileTitle: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 19, color: colors.ink },
  tileText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.muted },
  link: { alignSelf: "center", minHeight: 36, justifyContent: "center", paddingHorizontal: 8 },
  linkText: { fontFamily: fonts.bold, fontSize: 13, color: colors.teal, textDecorationLine: "underline" },
  note: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted },
});
