import { useFocusEffect, useIsFocused, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors, gradients, radii, shadows, typography } from "@/shared/theme/tokens";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Hint } from "@/shared/ui/hint";
import { FormField } from "@/shared/ui/form-field";
import { Sheet } from "@/shared/ui/sheet";
import { MAX_PAYMENT_QR_LENGTH, manualPayment, parsePaymentQr, type PaymentQrResult } from "../model/payment-qr";
import { BankPicker } from "@/features/finance/components/bank-picker";
import { resolveVietQrBank } from "@/features/finance/vietqr-banks";
import { Notice } from "@/shared/ui/journal";
import { PaymentQrCamera } from "./payment-qr-camera";
import { PaymentQrReview } from "./payment-qr-review";
import type { PaymentSimulationOptions } from './payment-qr-transfer';

type Mode = "camera" | "paste" | "manual";

/** Typed recipient for when the QR is damaged, on paper far away, or the camera is unavailable. */
function ManualRecipient({ onNext }: { onNext(result: PaymentQrResult): void }) {
  const [bank, setBank] = useState(""), [account, setAccount] = useState(""), [recipient, setRecipient] = useState("");
  const [error, setError] = useState<string>();
  return <View style={styles.manual}>
    <BankPicker value={bank} onChange={value => { setBank(value); setError(undefined); }} disabled={false} />
    <FormField label="Số tài khoản người nhận" icon="wallet" value={account} maxLength={30} autoCapitalize="characters" autoCorrect={false}
      placeholder="Ví dụ: 0866706255" onChangeText={value => { setAccount(value); setError(undefined); }} />
    <FormField label="Tên người nhận (không bắt buộc)" icon="edit" value={recipient} maxLength={50} autoCapitalize="characters" autoCorrect={false}
      placeholder="Ví dụ: NGUYEN VAN A" onChangeText={value => { setRecipient(value); setError(undefined); }} />
    {error && <Feedback message={error} />}
    <Button label="Tiếp tục" onPress={() => {
      const result = manualPayment({ bankBin: resolveVietQrBank(bank)?.bin, account, recipient });
      if (result.ok) { Keyboard.dismiss(); onNext(result); } else setError(result.message);
    }} />
  </View>;
}

const modes: { value: Mode; label: string; title: string }[] = [
  { value: "camera", label: "Dùng camera", title: "Camera" },
  { value: "paste", label: "Dán nội dung QR", title: "Dán mã" },
  { value: "manual", label: "Nhập thông tin thủ công", title: "Nhập tay" },
];

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange(mode: Mode): void }) {
  return <View style={styles.modes} accessibilityRole="tablist">
    {modes.map(item => <Pressable cssInterop={false} key={item.value} accessibilityRole="button" accessibilityLabel={item.label}
      accessibilityState={{ selected: mode === item.value }} onPress={() => onChange(item.value)}
      style={({ pressed }) => [styles.mode, mode === item.value && styles.modeActive, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.modeText, mode === item.value && styles.modeTextActive]}>{item.title}</Text>
    </Pressable>)}
  </View>;
}

function PaymentQrSession({ onClose, tripId, ...simulation }: { onClose: () => void; tripId?: string } & PaymentSimulationOptions) {
  const [mode, setMode] = useState<Mode>("camera");
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<PaymentQrResult>();
  const read = useCallback((value: string) => {
    Keyboard.dismiss();
    setResult(parsePaymentQr(value));
    setRaw("");
  }, []);
  const switchTo = (next: Mode) => { setResult(undefined); setRaw(""); setMode(next); };
  return <Sheet visible title={simulation.simulationOnly ? 'Thanh toán mô phỏng' : result?.ok ? "Chuyển khoản" : mode === "manual" ? "Nhập thông tin chuyển khoản" : "Quét QR chuyển khoản"} onClose={onClose}>
    {result ? <>
      {result.ok ? <>
        {mode === "manual" && <Notice>Thông tin nhập tay chưa được ngân hàng kiểm tra. Trước khi chuyển, đối chiếu tên người nhận hiện trong ứng dụng ngân hàng.</Notice>}
        <PaymentQrReview payment={result.payment} tripId={tripId} {...simulation} />
      </> : <Feedback message={result.message} />}
      <Button label={mode === "manual" ? "Sửa thông tin người nhận" : "Quét mã khác"} variant="soft" onPress={() => { setResult(undefined); if (mode !== "manual") setMode("camera"); }} />
      {!result.ok && <Button label="Dán nội dung QR" variant="soft" onPress={() => switchTo("paste")} />}
      {!result.ok && <Button label="Nhập thông tin thủ công" variant="text" onPress={() => switchTo("manual")} />}
    </> : <>
      <ModeSwitch mode={mode} onChange={switchTo} />
      {mode === "paste" ? <>
        <FormField label="Nội dung QR" icon="wallet" multiline value={raw} onChangeText={setRaw}
          autoCapitalize="none" autoCorrect={false} maxLength={MAX_PAYMENT_QR_LENGTH + 1} placeholder="000201..." />
        <Button label="Đọc thông tin QR" disabled={!raw.trim()} onPress={() => read(raw)} />
      </> : mode === "manual" ? <ManualRecipient onNext={setResult} /> : <PaymentQrCamera onScan={read} />}
      <Hint title={mode === "manual" ? "Khi nhập tay" : "Lưu ý khi quét"} points={mode === "manual"
        ? ["Dùng khi không quét được QR: mã mờ, rách, ở xa hoặc camera không dùng được.", "Số tiền và nội dung chuyển khoản nhập ở bước sau.", "App không lưu thông tin người nhận và không tự đánh dấu đã thanh toán."]
        : ["Chỉ hỗ trợ VietQR chuyển khoản bằng VND.", "Khi dán: dùng chuỗi bắt đầu bằng 000201, không phải đường dẫn hay ảnh.", "Không quét được? Chọn “Nhập tay” để điền ngân hàng và số tài khoản.", "Mã chỉ được đọc trên máy; app không lưu và không tự đánh dấu đã thanh toán."]} />
    </>}
  </Sheet>;
}

export function PaymentQrEntry(simulation: PaymentSimulationOptions = {}) {
  const { simulationOnly } = simulation;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [open, setOpen] = useState(false);
  const focused = useIsFocused();
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  return <>
    <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={simulationOnly ? 'Quét QR thanh toán mô phỏng' : 'Quét QR thanh toán'}
      onPress={() => setOpen(true)} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
        <DesignIcon name="wallet" size={24} tintColor={colors.onAccent} />
      </LinearGradient>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={typography.headline}>{simulationOnly ? 'Quét QR thanh toán mô phỏng' : 'Quét QR thanh toán'}</Text>
        <Text style={typography.footnote}>{simulationOnly ? 'Thử chi tiền từ quỹ, không chuyển tiền thật.' : 'Chi tiền từ quỹ bằng VietQR · dành cho người giữ quỹ'}</Text>
      </View>
      <DesignIcon name="chevron" size={18} tintColor={colors.muted} />
    </Pressable>
    {open && focused && <PaymentQrSession tripId={id} {...simulation} onClose={() => setOpen(false)} />}
  </>;
}

const styles = StyleSheet.create({
  tile: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  manual: { gap: 12 },
  modes: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radii.pill, backgroundColor: colors.fill },
  mode: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
  modeActive: { backgroundColor: colors.surface, ...shadows.glass },
  modeText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  modeTextActive: { color: colors.ink },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
