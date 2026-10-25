import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, StyleSheet, Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";

export function PaymentQrCamera({ onScan }: { onScan: (data: string) => void }) {
  // Read permissions explicitly so browser/native failures have a recoverable UI.
  const [permission, requestPermission, getPermission] = useCameraPermissions({ get: false });
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [torch, setTorch] = useState(false);
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

  return <>
    {error && <Feedback message={error} />}
    {!permission && !error && <ActivityIndicator accessibilityLabel="Đang kiểm tra quyền camera" color={colors.teal} />}
    {!permission?.granted ? <>
      <Text style={typography.body}>Cho phép dùng camera để quét VietQR. Wolfari không chụp, lưu ảnh hay ghi âm.</Text>
      {Platform.OS === "web" && <Text style={typography.footnote}>Camera trình duyệt cần HTTPS hoặc localhost. Nếu đã chặn, hãy cho phép camera trong cài đặt trang web rồi thử lại.</Text>}
      {permission?.canAskAgain === false && Platform.OS !== "web" ? <Button label="Mở cài đặt camera" onPress={() => {
        void Linking.openSettings().catch(() => setError("Không mở được cài đặt. Hãy vào Cài đặt thiết bị → Wolfari → Camera."));
      }} /> : <Button label="Cho phép camera" loading={busy} onPress={() => { void allowCamera(); }} />}
    </> : error ? <Button label="Thử lại camera" onPress={() => {
      setError(undefined);
      setTorch(false);
      accepting.current = active && AppState.currentState === "active";
    }} /> : active ? <>
      <View style={styles.preview}>
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
        <View pointerEvents="none" style={styles.guide} />
      </View>
      <Text style={typography.footnote}>Đưa một mã VietQR vào khung hình, giữ máy ổn định và đủ sáng.</Text>
      {Platform.OS !== "web" && <Button label={torch ? "Tắt đèn pin" : "Bật đèn pin"} variant="soft" onPress={() => setTorch(value => !value)} />}
    </> : <Text style={typography.body}>Camera đang tạm dừng.</Text>}
  </>;
}

const styles = StyleSheet.create({
  preview: { width: "100%", aspectRatio: 1, maxHeight: 300, backgroundColor: colors.ink, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  guide: { width: "76%", aspectRatio: 1, borderColor: colors.surface, borderWidth: 2, borderRadius: 18 },
});
