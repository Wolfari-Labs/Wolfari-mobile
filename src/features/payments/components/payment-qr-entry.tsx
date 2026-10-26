import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useState } from "react";
import { Keyboard, Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { ui } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { MAX_PAYMENT_QR_LENGTH, parsePaymentQr, type PaymentQrResult } from "../model/payment-qr";
import { PaymentQrCamera } from "./payment-qr-camera";
import { PaymentQrReview } from "./payment-qr-review";

function PaymentQrSession({ onClose }: { onClose: () => void }) {
  const [manual, setManual] = useState(false);
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<PaymentQrResult>();
  const read = useCallback((value: string) => {
    Keyboard.dismiss();
    setResult(parsePaymentQr(value));
    setRaw("");
  }, []);
  return <Sheet visible title="Quét QR chuyển khoản" onClose={onClose}>
    {result ? <>
      {result.ok ? <PaymentQrReview payment={result.payment} /> : <Feedback message={result.message} />}
      <Button label="Quét mã khác" variant="soft" onPress={() => { setResult(undefined); setManual(false); }} />
      {!result.ok && <Button label="Dán nội dung QR" variant="soft" onPress={() => { setResult(undefined); setManual(true); }} />}
    </> : <>
      {manual ? <>
        <Text style={typography.body}>Dán chuỗi dữ liệu VietQR (bắt đầu bằng 000201), không phải đường dẫn hay ảnh. Dữ liệu chỉ được đọc trên thiết bị.</Text>
        <FormField label="Nội dung QR" icon="wallet" multiline value={raw} onChangeText={setRaw}
          autoCapitalize="none" autoCorrect={false} maxLength={MAX_PAYMENT_QR_LENGTH + 1} placeholder="000201..." />
        <Button label="Đọc thông tin QR" disabled={!raw.trim()} onPress={() => read(raw)} />
      </> : <PaymentQrCamera onScan={read} />}
      <Button label={manual ? "Dùng camera" : "Dán nội dung QR"} variant="soft" onPress={() => { setRaw(""); setManual(value => !value); }} />
      <Text style={typography.footnote}>Hỗ trợ VietQR chuyển khoản đến tài khoản bằng VND. Không tự mở liên kết, lưu thông tin ngân hàng hoặc đánh dấu đã thanh toán.</Text>
    </>}
  </Sheet>;
}

export function PaymentQrEntry() {
  const [open, setOpen] = useState(false);
  const focused = useIsFocused();
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  return <>
    <View style={[ui.card, { backgroundColor: colors.mint }]}>
      <Text accessibilityRole="header" style={typography.headline}>Quét QR chuyển khoản</Text>
      <Text style={typography.body}>Đọc VietQR, kiểm tra và sao chép thông tin để chuyển khoản trong ứng dụng ngân hàng.</Text>
      <Button label="Quét QR thanh toán" icon="wallet" onPress={() => setOpen(true)} />
    </View>
    {open && focused && <PaymentQrSession onClose={() => setOpen(false)} />}
  </>;
}
