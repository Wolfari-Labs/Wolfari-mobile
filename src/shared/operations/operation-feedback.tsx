import { Text, View } from "react-native";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Notice, ui } from "@/shared/ui/journal";
import { operationCommitted, operationMessage } from "./controller";
import type { useTripOperation } from "./use-trip-operation";

export function OperationFeedback({ operation, onFinish, finishLabel = "Tải lại dữ liệu", }: {
  operation: ReturnType<typeof useTripOperation>; onFinish: () => void | Promise<void>; finishLabel?: string;
}) {
  const pending = operation.pending;
  return <View style={ui.stack}>
    {operation.error && <Feedback message={operation.error} />}
    {!operation.ready && <Button label="Đọc lại mã yêu cầu" variant="soft" onPress={() => { void operation.load(); }} />}
    {pending && <>
      <Text style={typography.headline}>{pending.title}</Text>
      <Feedback success={operationCommitted(pending)} message={operationMessage(pending)} />
      <Text style={typography.footnote}>Mã yêu cầu · giữ lại để tra cứu</Text>
      <Text selectable style={typography.body}>{pending.key}</Text>
      {operation.terminal ? <Button label={finishLabel} loading={operation.busy} onPress={() => { void (async () => { if (await operation.acknowledge()) await onFinish(); })(); }} /> : <>
        <Button label="Kiểm tra trạng thái" variant="soft" loading={operation.busy} onPress={() => { void operation.check(); }} />
        {pending.command && pending.operation?.state !== "NEEDS_REVIEW" && <Button label="Gửi lại cùng yêu cầu" loading={operation.busy} onPress={() => { void operation.retry(); }} />}
        {!pending.operation && <Button label="Bỏ yêu cầu này" variant="text" disabled={operation.busy} onPress={() => { void (async () => { if (await operation.discard()) await onFinish(); })(); }} />}
        <Notice>Mã yêu cầu được giữ khi mở lại app. Nội dung nhạy cảm không được lưu xuống thiết bị; sau khi khởi động lại chỉ tra cứu kết quả, không tự tạo giao dịch mới. Nếu không tìm thấy kết quả, liên hệ hỗ trợ với mã này.</Notice>
      </>}
    </>}
  </View>;
}
