import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { ProfileAvatar } from "../components/profile-avatar";
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
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>();
  const [picking, setPicking] = useState(false);
  const pickerLock = useRef(false);
  const uploaded = useRef<string | undefined>(undefined);
  async function choosePhoto() {
    if (pickerLock.current || command.busy) return;
    pickerLock.current = true; setPicking(true); setValidation(undefined);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mime = asset.mimeType ?? (/\.png(?:\?|$)/i.test(asset.uri) ? "image/png" : /\.jpe?g(?:\?|$)/i.test(asset.uri) ? "image/jpeg" : "");
      if (!["image/jpeg", "image/png"].includes(mime) || (asset.fileSize ?? 0) > 10 * 1024 * 1024 || asset.width * asset.height > 40_000_000) {
        setValidation("Chọn ảnh JPEG/PNG tối đa 10 MB và 40 megapixel."); return;
      }
      uploaded.current = undefined; setPhoto({ ...asset, mimeType: mime });
    } catch { setValidation("Chưa thể mở thư viện ảnh. Vui lòng thử lại."); }
    finally { pickerLock.current = false; setPicking(false); }
  }
  async function save() {
    if (!name.trim() || name.trim().length > 150) {
      setValidation("Họ và tên cần từ 1 đến 150 ký tự.");
      return;
    }
    setValidation(undefined);
    const input = { full_name: name.trim(), expected_version: profile.version };
    const result = await command.run({ ...input, photo: photo?.uri ?? photo }, async () => {
      if (photo && !uploaded.current) {
        const body = new FormData();
        if (Platform.OS === "web") {
          if (!photo.file) throw new Error("Chưa thể đọc ảnh đã chọn. Hãy chọn lại.");
          body.append("file", photo.file);
        } else {
          // React Native's multipart implementation accepts a local URI descriptor.
          body.append("file", { uri: photo.uri, type: photo.mimeType, name: photo.mimeType === "image/png" ? "avatar.png" : "avatar.jpg" } as unknown as Blob);
        }
        uploaded.current = (await api.account.uploadAvatar(body)).object_key;
      }
      return api.request<Profile>("/me", { method: "PATCH", body: {
        ...input, ...(photo === null ? { avatar_object_key: null } : uploaded.current ? { avatar_object_key: uploaded.current } : {}),
      } });
    });
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
          disabled={picking}
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
        <ProfileAvatar profile={photo === null ? { ...profile, avatar: null } : profile} preview={photo?.uri} />
        <Text style={typography.headline}>{profile.full_name}</Text>
      </View>
      <Button label="Chọn ảnh đại diện" variant="soft" loading={picking} disabled={command.busy} onPress={() => { void choosePhoto(); }} />
      {(photo || (profile.avatar && photo !== null)) && <Button label="Gỡ ảnh đại diện" variant="destructive" disabled={command.busy || picking} onPress={() => { uploaded.current = undefined; setPhoto(null); }} />}
      <Text style={typography.footnote}>JPEG/PNG · Tối đa 10 MB. Ảnh chỉ thay đổi khi bấm Lưu thay đổi.</Text>
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
