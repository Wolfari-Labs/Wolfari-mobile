import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Notice, ResourceFeedback } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { money } from "../model";
import { QrImage } from "./qr-image";

export function InstructionSheet({ contributionId, onClose }: { contributionId: string; onClose(): void }) {
  const api = useApi();
  const [consent, setConsent] = useState(false), [failed, setFailed] = useState(false);
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    const instruction = await api.finance.instruction(contributionId, signal);
    const url = new URL(instruction.qr_url);
    if (instruction.environment !== "TEST" || instruction.contribution_id !== contributionId || url.origin !== "https://img.vietqr.io" || url.username || url.password || !url.pathname.startsWith("/image/")) throw new Error("Chỉ dẫn thanh toán không hợp lệ.");
    return instruction;
  }, [api, contributionId]));
  const row = resource.data;
  return <Sheet visible title="VietQR · TEST" onClose={onClose}>
    <ResourceFeedback {...resource} hasData={!!row} onRetry={() => { void resource.reload(); }} />
    {row && <>
      <Notice>TEST — Không phải sandbox ngân hàng. Quét mã với tài khoản thật vẫn có thể chuyển tiền thật. App không tự chuyển hay xác minh tiền.</Notice>
      <Feedback message={row.warning} />
      <Text selectable style={typography.headline}>{money(row.amount)}</Text>
      <Text selectable style={typography.body}>Ngân hàng: {row.bank_code} · {row.bank_bin}</Text>
      <Text selectable style={typography.body}>Tài khoản: {row.account_number}</Text>
      <Text selectable style={typography.body}>Người nhận: {row.recipient_name}</Text>
      <Text selectable style={typography.body}>Nội dung: {row.reference}</Text>
      <Notice>Thông tin lấy từ tài khoản đã chốt khi phát hành khoản góp, không tự đổi theo tài khoản mặc định mới. Tên người nhận do người giữ quỹ khai, chưa được ngân hàng xác minh.</Notice>
      {consent ? <QrImage url={row.qr_url} onError={() => setFailed(true)} /> : <>
        <Notice>Để tải ảnh QR, tài khoản, tên người nhận, số tiền và nội dung chuyển sẽ được gửi đến Casso (img.vietqr.io). Chỉ tiếp tục nếu bạn đồng ý.</Notice>
        <Button label="Đồng ý tải ảnh VietQR TEST" variant="soft" onPress={() => setConsent(true)} />
      </>}
      {failed && <Feedback message="Không tải được ảnh QR. Kiểm tra mạng; không đoán thông tin hoặc số tiền." />}
      <Notice>Xem hoặc quét mã không có nghĩa đã báo chuyển hay đã nhận tiền. Trở lại khoản góp để báo chuyển sau khi đối chiếu.</Notice>
    </>}
  </Sheet>;
}
