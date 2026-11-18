import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Text, View } from "react-native";

import { bankDisplayName } from "@/features/finance/bank-names";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Details } from "@/shared/ui/details";
import { Feedback } from "@/shared/ui/feedback";
import { FadeInView, ui } from "@/shared/ui/journal";
import type { PaymentQr } from "../model/payment-qr";
import { PaymentQrTransfer, type PaymentSimulationOptions } from "./payment-qr-transfer";

export function PaymentQrReview({ payment, tripId, ...simulation }: { payment: PaymentQr; tripId?: string } & PaymentSimulationOptions) {
  const [feedback, setFeedback] = useState<{ message: string; success: boolean }>();
  const [copying, setCopying] = useState(false);
  const copy = async (value: string, label: string) => {
    setCopying(true);
    try {
      const copied = await Clipboard.setStringAsync(value);
      setFeedback({ success: copied, message: copied ? `Đã sao chép ${label.toLowerCase()}.` : "Không sao chép được. Bạn có thể nhấn giữ thông tin để sao chép thủ công." });
    } catch {
      setFeedback({ success: false, message: "Không sao chép được. Bạn có thể nhấn giữ thông tin để sao chép thủ công." });
    } finally {
      setCopying(false);
    }
  };
  const fields = [
    ...(payment.reference ? [{ label: "Mã tham chiếu", value: payment.reference }] : []),
    ...(payment.billNumber ? [{ label: "Mã hóa đơn", value: payment.billNumber }] : []),
  ];
  return <FadeInView>
    <View style={ui.card}>
      <Text style={typography.footnote}>Người nhận</Text>
      <Text selectable style={typography.headline}>{payment.recipientLabel || "QR không có tên người nhận"}</Text>
      <Text selectable style={typography.body}>{bankDisplayName(payment.bankBin)}</Text>
      <View style={ui.recordHeader}>
        <Text selectable style={typography.headline}>{payment.account}</Text>
        <Button compact variant="text" label="Sao chép số tài khoản" disabled={copying} onPress={() => { void copy(payment.account, 'Số tài khoản'); }} />
      </View>
      <Text style={typography.footnote}>Kiểm tra tên người nhận trong ứng dụng ngân hàng.</Text>
    </View>
    {!!fields.length && <Details title="Chi tiết QR">{fields.map(field => <View key={field.label} style={ui.row}>
      <View style={ui.recordHeader}>
        <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
          <Text style={typography.footnote}>{field.label}</Text>
          <Text selectable style={typography.body}>{field.value}</Text>
        </View>
        <Button compact variant="soft" label={`Sao chép ${field.label.toLowerCase()}`} disabled={copying} onPress={() => { void copy(field.value, field.label); }} />
      </View>
    </View>)}</Details>}
    <PaymentQrTransfer payment={payment} tripId={tripId} {...simulation} />
    {feedback && <Feedback {...feedback} />}
  </FadeInView>;
}
