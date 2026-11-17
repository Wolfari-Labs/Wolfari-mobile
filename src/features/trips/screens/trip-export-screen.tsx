import { useState } from "react";
import { presentPrivateFile } from "@/shared/files/private-file";
import { errorMessage } from "@/shared/api/errors";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Heading, Notice, ResourceFeedback } from "@/shared/ui/journal";
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
    <Notice>PDF gồm lịch trình, địa điểm đã gắn vào hoạt động, hành lý và dress code chung tại thời điểm xuất. Tệp không bao gồm sổ quỹ. Người nhận tệp có thể đọc nội dung; hãy chọn người nhận phù hợp.</Notice>
    <Button label="Xuất kế hoạch PDF" loading={busy} disabled={!data || !!resource.error || resource.loading} onPress={() => { void exportPdf(); }} />
    {error && <Feedback message={error} />}
    {opened && <Feedback success message="Đã mở tùy chọn tệp. Chọn nơi lưu hoặc ứng dụng nhận." />}
  </Screen>;
}
