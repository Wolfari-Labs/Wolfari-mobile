import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Heading, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { localTimestamp, parseDate } from "../utils";

export default function CreateTripScreen() {
  const { idea } = useLocalSearchParams<{ idea?: string }>();
  const api = useApi();
  const command = useCommand();
  const [step, setStep] = useState<"info" | "details">("info");
  const [name, setName] = useState(idea ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [description, setDescription] = useState("");
  const [validation, setValidation] = useState<string>();
  const timezone = "Asia/Ho_Chi_Minh";
  function valid() {
    if (!name.trim() || name.trim().length > 200) {
      setValidation("Tên chuyến đi cần từ 1 đến 200 ký tự.");
      return;
    }
    const first = parseDate(start),
      last = parseDate(end);
    if (!first || !last) {
      setValidation("Nhập ngày hợp lệ theo định dạng DD/MM/YYYY.");
      return;
    }
    if (last < first) {
      setValidation("Ngày về cần bằng hoặc sau ngày khởi hành.");
      return;
    }
    setValidation(undefined);
    return {
      name: name.trim(),
      start_at: localTimestamp(first, "00:00", timezone)!,
      end_at: localTimestamp(last, "23:59", timezone)!,
      timezone,
      ...(description.trim() ? { description: description.trim() } : {}),
    };
  }
  async function submit() {
    const input = valid();
    if (!input) return;
    if (step === "info") {
      setStep("details");
      return;
    }
    const trip = await command.run(input, (key) =>
      api.trips.create(input, key),
    );
    if (trip)
      router.replace({ pathname: "/trip/[id]", params: { id: trip.id } });
  }
  return (
    <Screen
      title="Chuyến đi mới"
      bottomPadding={24}
      onBack={() => {
        if (step === "details") setStep("info");
        else if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/trips");
      }}
      footer={
        <Button
          label={step === "info" ? "Tiếp tục" : "Tạo chuyến đi"}
          loading={command.busy}
          onPress={() => {
            void submit();
          }}
        />
      }
    >
      <Segments
        items={[
          { value: "info", label: "1  Thông tin" },
          { value: "details", label: "2  Cá nhân hóa" },
        ]}
        value={step}
        onChange={(value) => {
          if (value === "info" || valid()) setStep(value);
        }}
      />
      <Heading
        title={
          step === "info"
            ? "Hành trình bắt đầu\ntừ một ý tưởng"
            : "Theo cách của bạn"
        }
        subtitle={
          step === "details"
            ? "Một vài dòng để cả nhóm cùng hình dung."
            : undefined
        }
      />
      {validation && <Feedback message={validation} />}
      {command.error && <Feedback message={command.error} />}
      {step === "info" ? (
        <>
          <FormField
            label="Tên chuyến đi"
            icon="trip"
            value={name}
            onChangeText={setName}
            placeholder="Ví dụ: Đà Nẵng 3N2Đ"
            maxLength={200}
            editable={!command.busy}
          />
          <DateTimeField
            label="Ngày đi"
            value={start}
            onChangeText={setStart}
            editable={!command.busy}
          />
          <DateTimeField
            label="Ngày về"
            value={end}
            onChangeText={setEnd}
            editable={!command.busy}
          />
          <Text style={typography.footnote}>
            Giờ Việt Nam · UTC+7. Bạn sẽ mời bạn đồng hành sau khi tạo chuyến
            đi.
          </Text>
        </>
      ) : (
        <>
          <FormField
            label="Lời nhắn cho nhóm"
            icon="edit"
            value={description}
            onChangeText={setDescription}
            placeholder="Một chuyến đi thật đẹp cùng cả nhóm…"
            multiline
            maxLength={5000}
            editable={!command.busy}
          />
          <View style={ui.card}>
            <Text style={typography.headline}>{name}</Text>
            <Text style={typography.body}>
              {start} – {end}
            </Text>
            <Text style={[typography.footnote, { color: colors.teal }]}>
              Bạn là người tổ chức hành trình này.
            </Text>
          </View>
        </>
      )}
      <Image
        source={designAssets.tripCover}
        style={{
          width: "100%",
          height: step === "info" ? 150 : 180,
          borderRadius: 24,
          marginTop: 8,
        }}
        contentFit="cover"
      />
      <Text style={typography.footnote}>
        Ảnh gợi cảm hứng · Cầu Rồng, Đà Nẵng
      </Text>
    </Screen>
  );
}
