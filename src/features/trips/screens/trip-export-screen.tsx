import { useState } from "react";
import { Text } from "react-native";
import { typography } from "@/shared/theme/tokens";
import { presentPrivateFile } from "@/shared/files/private-file";
import { errorMessage } from "@/shared/api/errors";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Snackbar } from "@/shared/ui/toast";
import { Heading, ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";

export default function TripExportScreen() {
  const resource = useTrip(), { api, id, data } = resource;
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>(), [opened, setOpened] = useState(false);
  async function exportPdf() {
    if (busy || !data || resource.loading || resource.error) return;
    setBusy(true); setError(undefined); setOpened(false);
    try {
      const file = await api.request<Blob>(`/trips/${encodeURIComponent(id)}/plan.pdf`, { responseType: "blob" });
      if (file.type !== "application/pdf") throw Error("Máy chủ chưa trả kế hoạch PDF hợp lệ.");
      await presentPrivateFile(file, `wolfari-plan-${data.trip.name}.pdf`);
      setOpened(true);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <Screen title="Xuất kế hoạch">
    <Heading title="Mang kế hoạch theo bạn" subtitle={data?.trip.name} />
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    <Text style={typography.footnote}>PDF gồm lịch trình, địa điểm, hành lý và dress code. Không bao gồm sổ quỹ.</Text>
    <Button label="Xuất kế hoạch PDF" loading={busy} disabled={!data || !!resource.error || resource.loading} onPress={() => { void exportPdf(); }} />
    {error && <Feedback message={error} />}
    <Snackbar message={opened ? "Đã mở tùy chọn tệp. Chọn nơi lưu hoặc ứng dụng nhận." : undefined} />
  </Screen>;
}
