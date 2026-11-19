import { Image, type ImageSource, type ImageStyle } from "expo-image";
import type { ImagePickerAsset } from "expo-image-picker";
import { useCallback } from "react";
import { Platform, type StyleProp } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { blobDataUrl } from "@/shared/files/private-file-model";
import { useResource } from "@/shared/hooks/use-resource";
import type { Trip } from "../types";

export const COVER_LIMIT = 5 * 1024 * 1024;

/** Multipart body for POST /trips/:id/cover from an image-picker asset. */
export function coverBody(asset: ImagePickerAsset): FormData {
  const body = new FormData();
  if (Platform.OS === "web") {
    if (!asset.file) throw new Error("Chưa đọc được ảnh đã chọn. Hãy chọn lại.");
    body.append("file", asset.file);
  } else {
    // React Native's multipart implementation accepts a local URI descriptor.
    body.append("file", { uri: asset.uri, type: asset.mimeType ?? "image/jpeg", name: asset.mimeType === "image/png" ? "cover.png" : "cover.jpg" } as unknown as Blob);
  }
  return body;
}

export function coverProblem(asset: ImagePickerAsset): string | undefined {
  if (!asset.fileSize || asset.fileSize > COVER_LIMIT) return "Chọn ảnh có kích thước xác định, tối đa 5 MB.";
  if (asset.mimeType && !["image/jpeg", "image/png"].includes(asset.mimeType)) return "Ảnh bìa cần là JPG hoặc PNG.";
}

/** Private cover fetched with the session; `fallback` shows while loading or when none is stored. */
export function TripCoverImage({ trip, style, fallback, preview, label }: {
  trip: Pick<Trip, "id" | "cover_image_available" | "export_revision">;
  style: StyleProp<ImageStyle>;
  fallback: ImageSource | number;
  preview?: string;
  label?: string;
}) {
  const api = useApi();
  const revision = trip.export_revision;
  const stored = useResource(useCallback(async (signal: AbortSignal) => {
    void revision; // A replaced cover bumps export_revision; refetch then.
    const blob = await api.trips.cover(trip.id, signal);
    if (blob.type !== "image/jpeg" || blob.size < 1 || blob.size > 2 * 1024 * 1024) throw new Error("Ảnh bìa không hợp lệ.");
    return blobDataUrl(blob);
  }, [api, trip.id, revision]), !preview && !!trip.cover_image_available);
  const source = preview ? { uri: preview } : stored.data ? { uri: stored.data } : fallback;
  return <Image source={source} style={style} contentFit="cover" cachePolicy="none" accessibilityLabel={label ?? "Ảnh bìa chuyến đi"} />;
}
