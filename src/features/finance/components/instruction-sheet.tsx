import * as Clipboard from "expo-clipboard";
import { openURL } from "expo-linking";
import { useCallback, useState } from "react";
import { Platform, Text } from "react-native";
import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Details } from "@/shared/ui/details";
import { Feedback } from "@/shared/ui/feedback";
import { ResourceFeedback } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { money } from "../model";
import { bankDisplayName } from "../bank-names";
import { AUTOFILL_BANK_APPS, bankAppDeeplink, instructionQrImage } from "../extended-model";
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
  const [copied, setCopied] = useState<string>();
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    const instruction = await api.finance.instruction(contributionId, signal);
    if (instruction.contribution_id !== contributionId) throw new Error("Chỉ dẫn thanh toán không hợp lệ.");
    // The QR is rendered by the backend; publish it only if it encodes exactly this instruction.
    return { ...instruction, qr_image: instructionQrImage(instruction) };
  }, [api, contributionId]));
  const row = resource.data;
  const copy = async (value: string, done: string) => {
    try { await Clipboard.setStringAsync(value); setCopied(done); }
    catch { setCopied("Không sao chép được. Hãy chọn và sao chép thủ công."); }
  };
  const apps = row ? AUTOFILL_BANK_APPS.filter(app => deeplinkFor(row, app.id)) : [];
  return <Sheet visible title="Góp quỹ bằng VietQR" onClose={onClose}>
    <ResourceFeedback {...resource} hasData={!!row} onRetry={() => { void resource.reload(); }} />
    {row && <>
      <QrImage url={row.qr_image} onError={() => setFailed(true)} />
      {failed && <Feedback message="Không hiển thị được mã QR. Dùng thông tin bên dưới để chuyển thủ công." />}
      <Text selectable style={typography.headline}>{money(row.amount)}</Text>
      <Text selectable style={typography.body}>Ngân hàng: {bankDisplayName(row.bank_bin)}</Text>
      <Text selectable style={typography.body}>Tài khoản: {row.account_number}</Text>
      <Text selectable style={typography.body}>Chủ tài khoản: {row.recipient_name}</Text>
      <Text selectable style={typography.body}>Nội dung: {row.reference}</Text>
      <Button label="Sao chép nội dung chuyển khoản" variant="soft" compact onPress={() => { void copy(row.reference, "Đã sao chép nội dung chuyển khoản."); }} />
      <Button label="Sao chép mã QR" variant="soft" compact onPress={() => { void copy(row.qr_payload, "Đã sao chép mã QR. Dán vào tính năng quét từ ảnh/mã của app ngân hàng."); }} />
      {copied && <Text style={typography.footnote}>{copied}</Text>}
      {apps.length > 0 && (consent ? <>
        <Text accessibilityRole="header" style={typography.headline}>Mở app ngân hàng</Text>
        <Text style={typography.footnote}>Kiểm tra và xác nhận giao dịch trong ứng dụng ngân hàng.</Text>
        {apps.map(app => { const url = deeplinkFor(row, app.id); return url ? <Button key={app.id} label={app.name} accessibilityLabel={`Mở ${app.name} để chuyển ${money(row.amount)}`} variant="soft" compact onPress={() => { setOpenError(undefined); void openURL(url).catch(() => setOpenError(`Không mở được liên kết ${app.name}. Sao chép thông tin ở trên để chuyển thủ công.`)); }} /> : null; })}
        {openError && <Feedback message={openError} />}
      </> : <>
        <Text style={typography.footnote}>Tài khoản, số tiền và nội dung sẽ qua VietQR.io để mở ngân hàng với thông tin điền sẵn.</Text>
        <Button label="Mở app ngân hàng qua VietQR.io" variant="soft" onPress={() => setConsent(true)} />
      </>)}
      <Text style={typography.footnote}>Chuyển xong, trở lại khoản góp để báo đã chuyển.</Text>
      <Details title="Lưu ý chuyển khoản"><Text style={typography.footnote}>Đối chiếu tên người nhận trong ngân hàng trước khi xác nhận. Mở hoặc quét mã chưa làm thay đổi số dư quỹ.</Text></Details>
    </>}
  </Sheet>;
}
