import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, fonts } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { readQrFromImage } from "../model/qr-image";

/** Live QR scanner with a fallback for a QR saved as a picture (`allowImage`, on by default). */
export function PaymentQrCamera({ onScan, allowImage = true }: { onScan: (data: string) => void; allowImage?: boolean }) {
  // Read permissions explicitly so browser/native failures have a recoverable UI.
  const [permission, requestPermission, getPermission] = useCameraPermissions({ get: false });
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [torch, setTorch] = useState(false);
  const [picking, setPicking] = useState(false);
  const [imageError, setImageError] = useState<string>();
  const scanned = useRef(false);
  const accepting = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let revision = 0;
    const refresh = async () => {
      const request = ++revision;
      try {
        await getPermission();
        if (mounted.current && request === revision && AppState.currentState === "active") {
          accepting.current = true;
          setActive(true);
        }
      } catch {
        if (mounted.current && request === revision) setError("Không đọc được quyền camera. Bạn có thể thử cấp quyền hoặc dán nội dung QR.");
      }
    };
    void refresh();
    const subscription = AppState.addEventListener("change", state => {
      accepting.current = false;
      setActive(false);
      setTorch(false);
      if (state === "active") void refresh();
      else revision++;
    });
    return () => {
      mounted.current = false;
      accepting.current = false;
      revision++;
      subscription.remove();
    };
  }, [getPermission]);

  const allowCamera = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await requestPermission();
      if (mounted.current && AppState.currentState === "active") {
        accepting.current = true;
        setActive(true);
      }
    } catch {
      setError("Không thể xin quyền camera. Hãy kiểm tra cài đặt hoặc dán nội dung QR.");
    } finally {
      setBusy(false);
    }
  };
  const scan = useCallback(({ data }: { data: string }) => {
    // A synchronous lock prevents repeated camera frames from accepting two payments.
    if (!mounted.current || !accepting.current || scanned.current || AppState.currentState !== "active") return;
    scanned.current = true;
    accepting.current = false;
    setTorch(false);
    onScan(data);
  }, [onScan]);

  const pickImage = async () => {
    if (picking) return;
    setPicking(true);
    setImageError(undefined);
    try {
      const data = await readQrFromImage();
      if (!data || !mounted.current || scanned.current) return;
      scanned.current = true;
      accepting.current = false;
      setTorch(false);
      onScan(data);
    } catch (cause) {
      if (mounted.current) setImageError(cause instanceof Error ? cause.message : "Không đọc được ảnh QR.");
    } finally {
      if (mounted.current) setPicking(false);
    }
  };
  const imageButton = allowImage && <Button label="Chọn ảnh QR có sẵn trong máy" icon="file" variant="soft" loading={picking} onPress={() => { void pickImage(); }} />;

  return <View style={styles.wrap}>
    {error && <Feedback message={error} />}
    {!permission && !error && <ActivityIndicator accessibilityLabel="Đang kiểm tra quyền camera" color={colors.teal} />}
    {!permission?.granted ? <View style={styles.ask}>
      <View style={styles.askIcon}><DesignIcon name="camera" size={30} tintColor={colors.surface} /></View>
      <Text style={styles.askTitle}>Quét mã bằng camera</Text>
      <Text style={styles.askText}>Wolfari chỉ đọc mã QR trên máy, không chụp, lưu ảnh hay ghi âm.</Text>
      {Platform.OS === "web" && <Text style={styles.askText}>Camera trình duyệt cần HTTPS hoặc localhost. Nếu đã chặn, hãy cho phép camera trong cài đặt trang web.</Text>}
      {permission?.canAskAgain === false && Platform.OS !== "web" ? <Button label="Mở cài đặt camera" onPress={() => {
        void Linking.openSettings().catch(() => setError("Không mở được cài đặt. Hãy vào Cài đặt thiết bị → Wolfari → Camera."));
      }} /> : <Button label="Cho phép camera" loading={busy} onPress={() => { void allowCamera(); }} />}
    </View> : error ? <Button label="Thử lại camera" onPress={() => {
      setError(undefined);
      setTorch(false);
      accepting.current = active && AppState.currentState === "active";
    }} /> : active ? <View style={styles.preview}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus="on"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scan}
        onMountError={() => {
          accepting.current = false;
          setTorch(false);
          setError("Không mở được camera. Hãy đóng ứng dụng đang dùng camera, kiểm tra quyền rồi thử lại.");
        }}
      />
      <ScanFrame />
      <View pointerEvents="none" style={styles.caption}><Text style={styles.captionText}>Đưa mã VietQR vào giữa khung</Text></View>
      {Platform.OS !== "web" && <Pressable cssInterop={false} accessibilityRole="switch" accessibilityLabel="Đèn pin" accessibilityState={{ checked: torch }}
        onPress={() => setTorch(value => !value)} style={({ pressed }) => [styles.torch, torch && styles.torchOn, pressed && { opacity: 0.8 }]}>
        <DesignIcon name="sun" size={22} tintColor={torch ? colors.ink : colors.surface} />
      </Pressable>}
    </View> : <View style={[styles.preview, styles.paused]}><Text style={styles.captionText}>Camera đang tạm dừng</Text></View>}
    {imageError && <Feedback message={imageError} />}
    {imageButton}
  </View>;
}

/** Four corner brackets and, unless Reduce Motion is on, one slow scan line. */
function ScanFrame() {
  const { reduceMotion } = useAccessibilityPreferences();
  const line = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    line.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(line);
  }, [line, reduceMotion]);
  const lineStyle = useAnimatedStyle(() => ({ top: `${6 + line.get() * 88}%` }));
  return <View pointerEvents="none" style={styles.frame}>
    {(["tl", "tr", "bl", "br"] as const).map(corner => <View key={corner} style={[styles.corner, styles[corner]]} />)}
    {!reduceMotion && <Animated.View style={[styles.line, lineStyle]} />}
  </View>;
}

const C = 34, B = 4;
const styles = StyleSheet.create({
  wrap: { gap: 12 },
  preview: { width: "100%", aspectRatio: 0.86, maxHeight: 440, backgroundColor: colors.inkDeep, borderRadius: 28, borderCurve: "continuous", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  paused: { backgroundColor: colors.ocean },
  frame: { width: "70%", aspectRatio: 1, marginBottom: 28 },
  corner: { position: "absolute", width: C, height: C, borderColor: colors.surface },
  tl: { top: 0, left: 0, borderTopWidth: B, borderLeftWidth: B, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: B, borderRightWidth: B, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: B, borderLeftWidth: B, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: B, borderRightWidth: B, borderBottomRightRadius: 18 },
  line: { position: "absolute", left: "8%", right: "8%", height: 3, borderRadius: 2, backgroundColor: colors.gradientMint, boxShadow: "0 0 12px rgba(60,201,176,0.9)" },
  caption: { position: "absolute", bottom: 18, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(11,42,69,0.62)" },
  captionText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.surface },
  torch: { position: "absolute", top: 14, right: 14, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,42,69,0.55)" },
  torchOn: { backgroundColor: colors.sun },
  ask: { alignItems: "center", gap: 10, padding: 20, borderRadius: 28, borderCurve: "continuous", backgroundColor: colors.fill },
  askIcon: { width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.blue, marginBottom: 4 },
  askTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.ink },
  askText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: "center" },
});
