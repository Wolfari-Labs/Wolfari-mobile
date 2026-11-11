import { Text, View } from "react-native";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FadeInView, Notice, ui } from "@/shared/ui/journal";
import { operationCommitted, operationMessage } from "./controller";
import type { useTripOperation } from "./use-trip-operation";

export function OperationFeedback({ operation, onFinish, finishLabel = "Tải lại dữ liệu", }: {
  operation: ReturnType<typeof useTripOperation>; onFinish: () => void | Promise<void>; finishLabel?: string;
}) {
  const pending = operation.pending;
  if (!operation.error && operation.ready && !pending) return null;
  return <FadeInView>
    {operation.error && <Feedback message={operation.error} />}
    {!operation.ready && <Button label="Đọc lại trạng thái yêu cầu" compact variant="soft" onPress={() => { void operation.load(); }} />}
    {pending && <View style={ui.card}>
      <View style={ui.recordHeader}>
        <Text style={typography.headline}>{pending.title}</Text>
        {operation.terminal && <Button label={finishLabel} compact loading={operation.busy} onPress={() => { void (async () => { if (await operation.acknowledge()) await onFinish(); })(); }} />}
      </View>
      <Feedback success={operationCommitted(pending)} message={operationMessage(pending)} />
      {!operation.terminal && <>
        <View style={ui.actionRow}>
          <Button label="Kiểm tra trạng thái" compact variant="soft" loading={operation.busy} onPress={() => { void operation.check(); }} />
          {pending.command && pending.operation?.state !== "NEEDS_REVIEW" && <Button label="Gửi lại cùng yêu cầu" compact loading={operation.busy} onPress={() => { void operation.retry(); }} />}
          {!pending.operation && <Button label="Bỏ yêu cầu này" compact variant="text" disabled={operation.busy} onPress={() => { void (async () => { if (await operation.discard()) await onFinish(); })(); }} />}
        </View>
        <Notice>Yêu cầu được giữ khi mở lại app. Nội dung nhạy cảm không được lưu xuống thiết bị; sau khi khởi động lại chỉ tra cứu kết quả, không tự tạo giao dịch mới.</Notice>
      </>}
    </View>}
  </FadeInView>;
}
