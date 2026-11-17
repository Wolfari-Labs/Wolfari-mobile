import { useState } from "react";
import { Text } from "react-native";
import { typography } from "../theme/tokens";
import { Button } from "./button";
import { Feedback } from "./feedback";
import { Sheet } from "./sheet";

export function SnapshotConflict({ stale, disabled, onReplace }: { stale: boolean; disabled?: boolean; onReplace(): void }) {
  const [confirm, setConfirm] = useState(false);
  if (!stale) return null;
  return <>
    <Feedback message="Thông tin đã thay đổi. Bản đang chỉnh sửa được giữ để đối chiếu và chưa thể lưu. Hãy dùng bản mới rồi chỉnh sửa lại." />
    <Button label="Dùng thông tin mới nhất" variant="soft" disabled={disabled} onPress={() => setConfirm(true)} />
    <Sheet title="Thay bản đang chỉnh sửa?" visible={confirm} onClose={() => setConfirm(false)}>
      <Text style={typography.body}>Các thay đổi chưa lưu sẽ được thay bằng thông tin mới nhất vừa tải.</Text>
      <Button label="Dùng bản mới và chỉnh sửa lại" disabled={disabled} onPress={onReplace} />
    </Sheet>
  </>;
}
