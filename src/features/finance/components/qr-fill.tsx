import { useState } from "react";
import { Keyboard, Text } from "react-native";

import { PaymentQrCamera } from "@/features/payments/components/payment-qr-camera";
import { MAX_PAYMENT_QR_LENGTH, parsePaymentQr, type PaymentQr } from "@/features/payments/model/payment-qr";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";

/**
 * Reads a receiving account's VietQR on device to pre-fill form fields.
 * Nothing is stored or sent here; the user still reviews every field before submitting.
 */
export function QrFill({ onRead, onClose }: { onRead(payment: PaymentQr): string | undefined; onClose(): void }) {
  const [manual, setManual] = useState(false);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  function read(value: string) {
    Keyboard.dismiss();
    const result = parsePaymentQr(value);
    setRaw("");
    const problem = result.ok ? onRead(result.payment) : result.message;
    if (problem) { setError(problem); setAttempt(n => n + 1); }
  }
  return <>
    {error && <Feedback message={error} />}
    {manual ? <>
      <FormField label="Nội dung VietQR (000201…)" icon="wallet" multiline value={raw} onChangeText={setRaw}
        autoCapitalize="none" autoCorrect={false} maxLength={MAX_PAYMENT_QR_LENGTH + 1} placeholder="000201..." />
      <Button label="Đọc và điền thông tin" disabled={!raw.trim()} onPress={() => read(raw)} />
    </> : <PaymentQrCamera key={attempt} onScan={read} />}
    <Button label={manual ? "Dùng camera" : "Dán nội dung QR"} variant="soft" compact onPress={() => { setRaw(""); setManual(value => !value); }} />
    <Button label="Đóng quét QR" variant="soft" compact onPress={onClose} />
    <Text style={typography.footnote}>Dùng mã QR nhận tiền trong ứng dụng ngân hàng của người giữ quỹ. Ứng dụng chỉ đọc ngân hàng, số tài khoản và tên trên thiết bị; tên trong QR chưa được ngân hàng xác minh.</Text>
  </>;
}
