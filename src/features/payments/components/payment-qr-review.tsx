import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Text, View } from "react-native";

import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Notice, ui } from "@/shared/ui/journal";
import type { PaymentQr } from "../model/payment-qr";

export function PaymentQrReview({ payment }: { payment: PaymentQr }) {
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
    { label: "Mã ngân hàng (BIN)", value: payment.bankBin },
    { label: "Số tài khoản", value: payment.account },
    ...(payment.amount ? [{ label: "Số tiền", value: payment.amount, display: `${Number(payment.amount).toLocaleString("vi-VN")} ₫` }] : []),
    ...(payment.note ? [{ label: "Nội dung chuyển khoản", value: payment.note }] : []),
    ...(payment.reference ? [{ label: "Mã tham chiếu", value: payment.reference }] : []),
    ...(payment.billNumber ? [{ label: "Mã hóa đơn", value: payment.billNumber }] : []),
  ];
  return <>
    <Text accessibilityRole="header" style={typography.title}>Kiểm tra thông tin chuyển khoản</Text>
    <Notice>Thông tin được đọc từ QR, chưa xác minh với ngân hàng. Hãy đối chiếu ngân hàng, tên người nhận, số tài khoản và số tiền trong ứng dụng ngân hàng trước khi xác nhận.</Notice>
    <View style={ui.card}>
      <Text style={typography.footnote}>Tên ghi trong QR · Chưa xác minh</Text>
      <Text selectable style={typography.headline}>{payment.recipientLabel || "QR không có tên người nhận"}</Text>
    </View>
    {fields.map(field => <View key={field.label} style={ui.card}>
      <Text style={typography.footnote}>{field.label}</Text>
      <Text selectable style={typography.headline}>{"display" in field ? field.display : field.value}</Text>
      <Button compact variant="soft" label={`Sao chép ${field.label.toLowerCase()}`} disabled={copying} onPress={() => { void copy(field.value, field.label); }} />
    </View>)}
    {!payment.amount && <Notice>QR chưa có số tiền. Nhập số tiền đã thống nhất trong ứng dụng ngân hàng.</Notice>}
    {!payment.note && <Text style={typography.footnote}>QR không có nội dung chuyển khoản.</Text>}
    {feedback && <Feedback {...feedback} />}
    <Text style={typography.body}>Mở ứng dụng ngân hàng của bạn để thực hiện chuyển khoản. Wolfari không chuyển tiền, kiểm tra hạn dùng của QR hay xác nhận giao dịch; quỹ và bản nháp không thay đổi.</Text>
    <Text style={typography.footnote}>Không lưu lịch sử quét. Thông tin bạn chủ động sao chép sẽ nằm trong clipboard của thiết bị.</Text>
  </>;
}
