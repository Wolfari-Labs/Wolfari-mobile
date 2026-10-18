import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { Heading, ResourceFeedback, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useSession } from "../session/session-provider";
import type { Profile } from "../types";

export default function EditProfileScreen() {
  const api = useApi();
  const resource = useResource(
    useCallback(
      (signal: AbortSignal) => api.request<Profile>("/me", { signal }),
      [api],
    ),
  );
  if (!resource.data)
    return (
      <Screen title="Thông tin cá nhân">
        <ResourceFeedback
          {...resource}
          hasData={false}
          onRetry={() => {
            void resource.reload();
          }}
        />
      </Screen>
    );
  return <ProfileForm resource={resource} />;
}
function ProfileForm({
  resource,
}: {
  resource: ReturnType<typeof useResource<Profile>>;
}) {
  const api = useApi(),
    command = useCommand();
  const { updateProfile } = useSession();
  const profile = resource.data!;
  const [name, setName] = useState(profile.full_name);
  const [validation, setValidation] = useState<string>();
  async function save() {
    if (!name.trim() || name.trim().length > 150) {
      setValidation("Họ và tên cần từ 1 đến 150 ký tự.");
      return;
    }
    setValidation(undefined);
    const input = { full_name: name.trim(), expected_version: profile.version };
    const result = await command.run(input, () =>
      api.request<Profile>("/me", { method: "PATCH", body: input }),
    );
    if (result) {
      updateProfile(result);
      router.replace("/(tabs)/profile");
    }
  }
  return (
    <Screen
      title="Thông tin cá nhân"
      bottomPadding={24}
      footer={
        <Button
          label="Lưu thay đổi"
          loading={command.busy}
          onPress={() => {
            void save();
          }}
        />
      }
    >
      <Heading
        title="Thông tin của bạn"
        subtitle="Cập nhật để nhóm dễ nhận ra bạn."
      />
      <View style={[ui.row, { marginVertical: 20 }]}>
        <Image
          source={designAssets.profileMascot}
          style={{ width: 64, height: 64 }}
          contentFit="contain"
        />
        <Text style={typography.headline}>{profile.full_name}</Text>
      </View>
      {validation && <Feedback message={validation} />}
      {command.error && (
        <>
          <Feedback message={command.error} />
          <Button
            label="Cập nhật hồ sơ mới nhất"
            variant="soft"
            compact
            onPress={() => {
              void resource.reload();
            }}
          />
        </>
      )}
      <FormField
        label="Họ và tên"
        icon="edit"
        value={name}
        onChangeText={setName}
        maxLength={150}
        editable={!command.busy}
      />
      <FormField
        label="Email"
        icon="mail"
        value={profile.email}
        editable={false}
      />
      <Text style={typography.footnote}>
        Email dùng để nhận lời mời và xác định tài khoản của bạn.
      </Text>
    </Screen>
  );
}
