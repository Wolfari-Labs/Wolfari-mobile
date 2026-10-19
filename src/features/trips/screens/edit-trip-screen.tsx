import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Heading, ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { coverFor } from "../components/trip-card";
import { useTrip } from "../hooks/use-trip";
import { tripDates } from "../utils";

export default function EditTripScreen() {
  const resource = useTrip();
  if (!resource.data) return <Screen title="Chỉnh sửa chuyến đi"><ResourceFeedback {...resource} hasData={false} onRetry={() => { void resource.reload(); }} /></Screen>;
  if (!resource.data.trip.permissions.can_update) return <Screen title="Chỉnh sửa chuyến đi"><EmptyState title="Thông tin của nhóm" message="Bạn chưa có quyền cập nhật thông tin chuyến đi." /></Screen>;
  return <EditTripForm resource={resource} />;
}
function EditTripForm({ resource }: { resource: ReturnType<typeof useTrip> }) {
  const { trip } = resource.data!; const command = useCommand();
  const [name, setName] = useState(trip.name); const [description, setDescription] = useState(trip.description ?? ""); const [publicDescription, setPublicDescription] = useState(trip.public_description ?? ""); const [validation, setValidation] = useState<string>();
  async function save() {
    if (!name.trim() || name.trim().length > 200) { setValidation("Tên chuyến đi cần từ 1 đến 200 ký tự."); return; }
    setValidation(undefined);
    const input = { name: name.trim(), description: description.trim() || null, public_description: publicDescription.trim() || null };
    const result = await command.run({ ...input, version: trip.plan_version, revision: trip.export_revision }, key => resource.api.trips.update(trip, input, key));
    if (result) router.replace({ pathname: "/trip/[id]/settings", params: { id: trip.id } });
  }
  return <Screen title="Chỉnh sửa chuyến đi" bottomPadding={24} footer={<Button label="Lưu thay đổi" loading={command.busy} onPress={() => { void save(); }} />}>
    <Image source={coverFor(trip)} style={{ width: "100%", height: 166, borderRadius: 24 }} contentFit="cover" /><Heading title={trip.name} subtitle="Cập nhật thông tin cho cả nhóm." />
    {validation && <Feedback message={validation} />}{command.error && <><Feedback message={command.error} /><Button label="Tải thông tin mới nhất" variant="soft" compact onPress={() => { void resource.reload(); }} /></>}
    <FormField label="Tên chuyến đi" icon="trip" value={name} onChangeText={setName} maxLength={200} editable={!command.busy} /><Text style={typography.footnote}>{tripDates(trip)} · {trip.timezone}</Text>
    <FormField label="Mô tả cho nhóm" icon="edit" value={description} onChangeText={setDescription} multiline maxLength={5000} editable={!command.busy} /><FormField label="Giới thiệu công khai" icon="compass" value={publicDescription} onChangeText={setPublicDescription} multiline maxLength={5000} editable={!command.busy} />
  </Screen>;
}
