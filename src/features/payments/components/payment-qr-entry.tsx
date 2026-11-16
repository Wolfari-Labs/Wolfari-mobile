import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useState } from "react";
import { Keyboard, Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Hint } from "@/shared/ui/hint";
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
        <FormField label="Nội dung QR" icon="wallet" multiline value={raw} onChangeText={setRaw}
          autoCapitalize="none" autoCorrect={false} maxLength={MAX_PAYMENT_QR_LENGTH + 1} placeholder="000201..." />
        <Button label="Đọc thông tin QR" disabled={!raw.trim()} onPress={() => read(raw)} />
      </> : <PaymentQrCamera onScan={read} />}
      <Button label={manual ? "Dùng camera" : "Dán nội dung QR"} variant="soft" onPress={() => { setRaw(""); setManual(value => !value); }} />
      <Hint title="Lưu ý khi quét" points={["Chỉ hỗ trợ VietQR chuyển khoản bằng VND.", "Khi dán: dùng chuỗi bắt đầu bằng 000201, không phải đường dẫn hay ảnh.", "Mã chỉ được đọc trên máy; app không lưu và không tự đánh dấu đã thanh toán."]} />
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
      <Button label="Quét QR thanh toán" icon="wallet" onPress={() => setOpen(true)} />
    </View>
    {open && focused && <PaymentQrSession onClose={() => setOpen(false)} />}
  </>;
}
