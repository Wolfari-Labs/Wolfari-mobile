import { openURL } from "expo-linking";
import { useCallback, useState } from "react";
import { Platform, Text } from "react-native";
import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Notice, ResourceFeedback } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { money } from "../model";
import { AUTOFILL_BANK_APPS, bankAppDeeplink, instructionQrUrl } from "../extended-model";
import type { PaymentInstruction } from "../types";
import { QrImage } from "./qr-image";

// The app scheme from app.json. Not createURL(): in Expo Go that is exp://<LAN IP>:<port>,
// which would be sent to dl.vietqr.io and the bank app.
const RETURN_URL = "wolfarimobile://";

function deeplinkFor(row: PaymentInstruction, appId: string): string | undefined {
  // Bank apps exist only on phones; on web, window.open would also send the app's origin as Referer.
  if (Platform.OS === "web") return undefined;
  try { return bankAppDeeplink(row, appId, RETURN_URL); } catch { return undefined; }
}

export function InstructionSheet({ contributionId, onClose }: { contributionId: string; onClose(): void }) {
  const api = useApi();
  const [consent, setConsent] = useState(false), [failed, setFailed] = useState(false);
  const [openError, setOpenError] = useState<string>();
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    const instruction = await api.finance.instruction(contributionId, signal);
    if (instruction.contribution_id !== contributionId) throw new Error("Chỉ dẫn thanh toán không hợp lệ.");
    // The image URL must encode exactly this instruction's bank, account, amount, reference and name.
    return { ...instruction, qr_url: instructionQrUrl(instruction) };
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
        <Notice>Để tải ảnh QR hoặc mở app ngân hàng, tài khoản, tên người nhận, số tiền và nội dung chuyển sẽ được gửi đến Casso (img.vietqr.io, dl.vietqr.io). Chỉ tiếp tục nếu bạn đồng ý.</Notice>
        <Button label="Đồng ý tải ảnh VietQR TEST" variant="soft" onPress={() => setConsent(true)} />
      </>}
      {failed && <Feedback message="Không tải được ảnh QR. Kiểm tra mạng; không đoán thông tin hoặc số tiền." />}
      {consent && AUTOFILL_BANK_APPS.some(app => deeplinkFor(row, app.id)) && <>
        <Text accessibilityRole="header" style={typography.headline}>Mở app ngân hàng</Text>
        <Notice>Các app dưới đây tự điền tài khoản, số tiền và nội dung. Bạn vẫn kiểm tra người nhận và xác nhận chuyển trong app ngân hàng. Nếu máy chưa cài app, trang web VietQR sẽ mở thay. Ngân hàng khác: sao chép thông tin ở trên rồi tự mở app.</Notice>
        {AUTOFILL_BANK_APPS.map(app => { const url = deeplinkFor(row, app.id); return url ? <Button key={app.id} label={app.name} accessibilityLabel={`Mở ${app.name} để chuyển ${money(row.amount)}`} variant="soft" compact onPress={() => { setOpenError(undefined); void openURL(url).catch(() => setOpenError(`Không mở được liên kết ${app.name}. Sao chép thông tin ở trên để chuyển thủ công.`)); }} /> : null; })}
        {openError && <Feedback message={openError} />}
      </>}
      <Notice>Xem hoặc quét mã không có nghĩa đã báo chuyển hay đã nhận tiền. Trở lại khoản góp để báo chuyển sau khi đối chiếu.</Notice>
    </>}
  </Sheet>;
}
