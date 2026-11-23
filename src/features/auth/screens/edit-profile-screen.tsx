import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Button } from "@/shared/ui/button";
import { ProfileAvatar } from "../components/profile-avatar";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { ResourceFeedback } from "@/shared/ui/journal";
import { SnapshotConflict } from "@/shared/ui/snapshot-conflict";
import { toast } from "@/shared/ui/toast";
import { Screen } from "@/shared/ui/screen";
import { useSession } from "../session/session-provider";
import type { Profile } from "../types";

export default function EditProfileScreen() {
  const api = useApi();
  const [edition, setEdition] = useState(0);
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
  return <ProfileForm key={edition} resource={resource} onReplace={() => setEdition(value => value + 1)} />;
}
function ProfileForm({
  resource,
  onReplace,
}: {
  resource: ReturnType<typeof useResource<Profile>>;
  onReplace(): void;
}) {
  const api = useApi(),
    command = useCommand();
  const { updateProfile } = useSession();
  const profile = resource.data!;
  const [baseVersion] = useState(profile.version);
  const stale = baseVersion !== profile.version;
  const blocked = stale || resource.loading || !!resource.error;
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
    if (blocked || command.busy || picking) return;
    if (!name.trim() || name.trim().length > 150) {
      setValidation("Họ và tên cần từ 1 đến 150 ký tự.");
      return;
    }
    setValidation(undefined);
    const input = { full_name: name.trim(), expected_version: baseVersion };
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
      toast.success("Đã cập nhật thông tin cá nhân.");
      // Return to where the user came from instead of stacking another copy of the tabs.
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/profile");
    }
  }
  const removing = photo === null;
  const hasPhoto = !!photo || (!!profile.avatar && !removing);
  const changed = name.trim() !== profile.full_name || photo !== undefined;
  return (
    <Screen
      title="Thông tin cá nhân"
      bottomPadding={24}
      footer={
        <Button
          label={changed ? "Lưu thay đổi" : "Chưa có thay đổi"}
          loading={command.busy}
          disabled={picking || blocked || !changed}
          onPress={() => {
            void save();
          }}
        />
      }
    >
      <View style={styles.avatarBlock}>
        <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Chọn ảnh đại diện" disabled={command.busy || picking}
          onPress={() => { void choosePhoto(); }} style={({ pressed }) => [styles.avatarRing, pressed && { opacity: 0.85 }]}>
          <ProfileAvatar profile={removing ? { ...profile, avatar: null } : profile} preview={photo?.uri} size={112} />
          <View style={styles.camera}><DesignIcon name="edit" size={15} tintColor={colors.surface} /></View>
        </Pressable>
        <Text style={styles.name} numberOfLines={2}>{name.trim() || profile.full_name}</Text>
        <View style={styles.photoActions}>
          <Button label={hasPhoto ? "Đổi ảnh" : "Thêm ảnh"} variant="text" compact loading={picking} disabled={command.busy} onPress={() => { void choosePhoto(); }} />
          {hasPhoto && <Button label="Gỡ ảnh đại diện" accessibilityLabel="Gỡ ảnh đại diện" variant="text" compact disabled={command.busy || picking} onPress={() => { uploaded.current = undefined; setPhoto(null); }} />}
        </View>
        <Text style={[typography.footnote, styles.center]}>
          {photo ? "Ảnh mới sẽ được lưu khi bấm Lưu thay đổi." : removing ? "Ảnh sẽ được gỡ khi bấm Lưu thay đổi." : "JPEG/PNG · tối đa 10 MB"}
        </Text>
      </View>
      <SnapshotConflict stale={stale} disabled={resource.loading || !!resource.error} onReplace={onReplace} />
      {resource.error && <Feedback message={resource.error} />}
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
      <View style={styles.card}>
        <FormField
          label="Họ và tên"
          icon="edit"
          value={name}
          onChangeText={setName}
          maxLength={150}
          editable={!command.busy}
        />
        <Text style={styles.hint}>Tên này hiện với bạn đồng hành trong chuyến đi, quỹ và lời mời.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Email đăng nhập</Text>
        <View style={styles.emailRow}>
          <DesignIcon name="mail" size={18} tintColor={colors.muted} />
          <Text selectable style={[typography.body, { flex: 1 }]} numberOfLines={1}>{profile.email}</Text>
          <View style={[styles.chip, profile.email_verified_at ? styles.chipOk : styles.chipWarn]}>
            <Text style={[styles.chipText, { color: profile.email_verified_at ? colors.pinGreen : colors.amber }]}>{profile.email_verified_at ? "Đã xác minh" : "Chưa xác minh"}</Text>
          </View>
        </View>
        <Text style={styles.hint}>Email dùng để nhận lời mời và khôi phục tài khoản; hiện chưa đổi được trong ứng dụng.</Text>
        {!profile.email_verified_at && <Button label="Xác minh email ngay" variant="soft" compact onPress={() => router.push("/verify-email")} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarBlock: { alignItems: "center", gap: 8, paddingTop: 4 },
  avatarRing: { width: 124, height: 124, borderRadius: 62, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadows.card },
  camera: { position: "absolute", right: 4, bottom: 6, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.surface },
  name: { ...typography.section, textAlign: "center", marginTop: 6 },
  photoActions: { flexDirection: "row", gap: 16, justifyContent: "center" },
  center: { textAlign: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, gap: 10, ...shadows.glass },
  label: { ...typography.eyebrow, textTransform: "uppercase" },
  hint: { ...typography.footnote },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  chipOk: { backgroundColor: colors.mint },
  chipWarn: { backgroundColor: colors.butter },
  chipText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
});
