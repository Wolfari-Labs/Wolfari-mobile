import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { amountLabel } from "../model/quick-transfer";
import type { PaymentTransfer } from "../model/payment-transfer";

/** What the pretend bank tells Wolfari when it hands control back. */
export type SandboxBankResult = { status: "success"; reference: string; paidAt: string } | { status: "cancelled" };

type Phase = "launch" | "login" | "form" | "otp" | "processing" | "done";
export const SANDBOX_OTP = "000000";
const AUTO_RETURN_SECONDS = 5;

/**
 * Sandbox only: a stand-in bank app that takes over the whole screen, so testing the QR payment feels
 * like switching to a real bank app and back. It has its own look on purpose (not Wolfari's).
 * No money moves; success is reported back to Wolfari, which then records the expense.
 */
export function SandboxBankApp({ transfer, bankLabel, onFinish }: {
  transfer: PaymentTransfer; bankLabel: string; onFinish(result: SandboxBankResult): void;
}) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("launch");
  const [otp, setOtp] = useState("");
  const [result, setResult] = useState<Extract<SandboxBankResult, { status: "success" }>>();
  const [countdown, setCountdown] = useState(AUTO_RETURN_SECONDS);
  const [scanning, setScanning] = useState(false);
  const motion = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  // Mounted once per opening (the parent renders it only while open), so each opening is a fresh launch.
  useEffect(() => {
    Animated.timing(motion, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
    const timer = setTimeout(() => setPhase("login"), 900);
    return () => clearTimeout(timer);
  }, [motion]);

  useEffect(() => {
    if (!scanning) return;
    const timer = setTimeout(() => { setScanning(false); setPhase("form"); }, 700);
    return () => clearTimeout(timer);
  }, [scanning]);

  useEffect(() => {
    if (phase !== "processing") return;
    const timer = setTimeout(() => {
      const now = new Date();
      const stamp = `${now.getFullYear() % 100}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      setResult({ status: "success", reference: `FT${stamp}${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, paidAt: now.toISOString() });
      setPhase("done");
    }, 1200);
    return () => clearTimeout(timer);
  }, [phase]);

  // The receipt hands back to Wolfari on its own, like a bank app returning to the merchant.
  useEffect(() => {
    if (phase !== "done") return;
    if (countdown <= 0) { leave(result ?? { status: "cancelled" }); return; }
    const timer = setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  });

  function leave(outcome: SandboxBankResult) {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(motion, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== "web" })
      .start(() => onFinish(outcome));
  }

  const cancel = () => leave({ status: "cancelled" });
  const back = () => (phase === "done" ? leave(result ?? { status: "cancelled" }) : cancel());
  const opacity = motion;
  const scale = motion.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={back}>
    <StatusBar style="light" />
    <Animated.View style={[bank.root, { opacity, transform: [{ scale }] }]} accessibilityViewIsModal>
      {phase === "launch" ? <View style={bank.splash} accessibilityLabel="Đang mở Ngân hàng thử">
        <View style={bank.markLarge}><Text style={bank.markLargeText}>NHT</Text></View>
        <Text style={bank.splashName}>Ngân hàng thử</Text>
        <Text style={bank.splashTag}>Sandbox · không chuyển tiền thật</Text>
        <ActivityIndicator color="#F2C94C" style={{ marginTop: 28 }} />
      </View> : <>
        <View style={[bank.bar, { paddingTop: insets.top + 10 }]}>
          <View style={bank.mark}><Text style={bank.markText}>NHT</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={bank.barTitle}>{phase === "login" ? "Ngân hàng thử" : phase === "done" ? "Kết quả giao dịch" : "Chuyển tiền"}</Text>
            <Text style={bank.barSub}>Sandbox · không chuyển tiền thật</Text>
          </View>
          {phase !== "done" && phase !== "processing" && <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Huỷ giao dịch" onPress={cancel} hitSlop={10}>
            <Text style={bank.barAction}>Huỷ</Text>
          </Pressable>}
        </View>
        <ScrollView style={bank.body} contentContainerStyle={[bank.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          {phase === "login" && <View style={bank.loginBox}>
            <Text style={bank.hello}>Xin chào,</Text>
            <Text style={bank.helloName}>KHÁCH THỬ NGHIỆM</Text>
            <Text style={[bank.muted, bank.center]}>Có lệnh chuyển tiền từ Wolfari đang chờ bạn đăng nhập.</Text>
            <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Đăng nhập bằng vân tay" disabled={scanning} onPress={() => setScanning(true)}
              style={({ pressed }) => [bank.finger, pressed && { opacity: 0.8 }]}>
              {scanning ? <ActivityIndicator color="#00573F" /> : <Text style={bank.fingerIcon}>◉</Text>}
            </Pressable>
            <Text style={[bank.muted, bank.center]}>{scanning ? "Đang xác thực…" : "Chạm để đăng nhập bằng vân tay"}</Text>
          </View>}

          {(phase === "form" || phase === "otp" || phase === "processing") && <>
            <View style={bank.card}>
              <Text style={bank.caption}>Từ tài khoản</Text>
              <Text style={bank.strong}>1900 6868 0000 · Thanh toán</Text>
              <Text style={bank.muted}>Số dư khả dụng 50.000.000 VND</Text>
            </View>
            <View style={bank.card}>
              <Text style={bank.caption}>Đến</Text>
              <Text style={bank.strong}>{(transfer.recipientLabel || "Người nhận").toUpperCase()}</Text>
              <Text style={bank.muted}>{transfer.account} · {bankLabel}</Text>
              <View style={bank.divider} />
              <Text style={bank.caption}>Số tiền</Text>
              <Text style={bank.amount}>{amountLabel(transfer.amount)}</Text>
              <View style={bank.divider} />
              <Text style={bank.caption}>Nội dung</Text>
              <Text style={bank.strong}>{transfer.note}</Text>
              <Text style={[bank.muted, { marginTop: 8 }]}>Thông tin được điền sẵn từ mã VietQR.</Text>
            </View>
          </>}

          {phase === "form" && <BankButton label="Tiếp tục" onPress={() => setPhase("otp")} />}

          {phase === "otp" && <View style={bank.card}>
            <Text style={bank.strong}>Xác thực Smart OTP</Text>
            <Text style={bank.muted}>Mã thử nghiệm là {SANDBOX_OTP}.</Text>
            <TextInput value={otp} onChangeText={value => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoFocus
              placeholder="••••••" placeholderTextColor="#9AA5A0" accessibilityLabel="Mã OTP" style={bank.otp} maxLength={6} />
            {otp.length === 6 && otp !== SANDBOX_OTP && <Text style={bank.error}>Mã OTP không đúng. Nhập {SANDBOX_OTP}.</Text>}
            <BankButton label="Xác nhận chuyển" disabled={otp !== SANDBOX_OTP} onPress={() => setPhase("processing")} />
          </View>}

          {phase === "processing" && <View style={bank.processing}>
            <ActivityIndicator color="#00573F" />
            <Text style={[bank.muted, bank.center]}>Đang xử lý giao dịch…</Text>
          </View>}

          {phase === "done" && result && <View style={bank.receipt}>
            <View style={bank.tick}><Text style={bank.tickText}>✓</Text></View>
            <Text style={bank.successTitle}>Giao dịch thành công</Text>
            <Text style={bank.amount}>{amountLabel(transfer.amount)}</Text>
            <View style={[bank.card, { alignSelf: "stretch" }]}>
              <Line label="Người nhận" value={(transfer.recipientLabel || transfer.account).toUpperCase()} />
              <Line label="Tài khoản" value={`${transfer.account} · ${bankLabel}`} />
              <Line label="Nội dung" value={transfer.note} />
              <Line label="Mã giao dịch" value={result.reference} />
              <Line label="Thời gian" value={new Date(result.paidAt).toLocaleString("vi-VN")} />
            </View>
            <BankButton label="Quay về Wolfari" onPress={() => leave(result)} />
            <Text style={[bank.muted, bank.center]}>Tự quay về Wolfari sau {countdown} giây</Text>
          </View>}
        </ScrollView>
      </>}
    </Animated.View>
  </Modal>;
}

function BankButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress(): void }) {
  return <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} aria-disabled={!!disabled} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [bank.button, disabled && { backgroundColor: "#B9C7C1" }, pressed && { opacity: 0.85 }]}>
    <Text style={bank.buttonText}>{label}</Text>
  </Pressable>;
}

function Line({ label, value }: { label: string; value: string }) {
  return <View style={bank.line}>
    <Text style={bank.caption}>{label}</Text>
    <Text selectable style={bank.lineValue}>{value}</Text>
  </View>;
}

const green = "#00573F", gold = "#F2C94C";
const bank = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F4F2" },
  splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: green, gap: 6 },
  markLarge: { width: 84, height: 84, borderRadius: 22, backgroundColor: gold, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  markLargeText: { fontSize: 26, fontWeight: "800", color: green, letterSpacing: 1 },
  splashName: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  splashTag: { fontSize: 13, color: "#CFE3DA" },
  bar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: green },
  mark: { width: 36, height: 36, borderRadius: 10, backgroundColor: gold, alignItems: "center", justifyContent: "center" },
  markText: { fontSize: 12, fontWeight: "800", color: green },
  barTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  barSub: { fontSize: 12, color: "#CFE3DA" },
  barAction: { fontSize: 15, fontWeight: "600", color: gold },
  body: { flex: 1 },
  content: { padding: 16, gap: 12 },
  loginBox: { alignItems: "center", gap: 8, paddingTop: 40 },
  hello: { fontSize: 16, color: "#4A5A53" },
  helloName: { fontSize: 20, fontWeight: "700", color: "#13241D" },
  finger: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: green, alignItems: "center", justifyContent: "center", marginTop: 32, backgroundColor: "#FFFFFF" },
  fingerIcon: { fontSize: 40, color: green },
  card: { backgroundColor: "#FFFFFF", borderRadius: 8, padding: 14, gap: 4, borderWidth: 1, borderColor: "#E1E8E4" },
  caption: { fontSize: 12, color: "#6B7A73" },
  strong: { fontSize: 15, fontWeight: "600", color: "#13241D" },
  muted: { fontSize: 13, color: "#6B7A73" },
  center: { textAlign: "center" },
  amount: { fontSize: 26, fontWeight: "700", color: green },
  divider: { height: 1, backgroundColor: "#E1E8E4", marginVertical: 8 },
  otp: { marginVertical: 10, borderWidth: 1, borderColor: "#C9D5CF", borderRadius: 8, paddingVertical: 12, fontSize: 24, letterSpacing: 10, textAlign: "center", color: "#13241D" },
  error: { fontSize: 13, color: "#C0392B", marginBottom: 6 },
  button: { backgroundColor: green, borderRadius: 8, paddingVertical: 15, alignItems: "center", alignSelf: "stretch" },
  buttonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  processing: { alignItems: "center", gap: 10, paddingVertical: 24 },
  receipt: { alignItems: "center", gap: 10, paddingTop: 12 },
  tick: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#1E9E62", alignItems: "center", justifyContent: "center" },
  tickText: { fontSize: 32, color: "#FFFFFF", fontWeight: "700" },
  successTitle: { fontSize: 18, fontWeight: "700", color: "#13241D" },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  lineValue: { flex: 1, textAlign: "right", fontSize: 14, fontWeight: "600", color: "#13241D" },
});
