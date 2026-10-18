import { Image } from "expo-image";
import { useCallback } from "react";

import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { designAssets } from "@/shared/ui/design-assets";
import type { Profile } from "../types";

export function ProfileAvatar({ profile, preview, size = 64 }: { profile: Profile | null; preview?: string; size?: number }) {
  const api = useApi();
  const avatar = profile?.avatar, version = profile?.version, userId = profile?.id;
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    // Keep private image bytes in memory; never put a bearer token in an image URL.
    const blob = await api.account.avatar(signal);
    const uri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Chưa thể đọc ảnh đại diện."));
      reader.readAsDataURL(blob);
    });
    return { uri, userId, version };
  }, [api, version, userId]), !!avatar && !preview);
  const current = resource.data?.userId === userId && resource.data?.version === version;
  return <Image source={preview ? { uri: preview } : avatar && current && resource.data ? { uri: resource.data.uri } : designAssets.profileMascot}
    cachePolicy="none" accessibilityLabel={resource.error ? "Chưa tải được ảnh đại diện" : "Ảnh đại diện"}
    style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
}
