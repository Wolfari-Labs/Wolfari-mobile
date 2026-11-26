import { Asset } from "expo-asset";
import { Platform } from "react-native";

import { designAssets } from "@/shared/ui/design-assets";

/** Bundled covers offered on the create page (Figma D · M07). */
export const PRESET_COVERS = [
  { key: "pastelDestination", label: "Vịnh biển", source: designAssets.pastelDestination },
  { key: "pastelCoast", label: "Bờ biển", source: designAssets.pastelCoast },
  { key: "pastelBridge", label: "Cây cầu", source: designAssets.pastelBridge },
] as const;

/** Multipart body for POST /trips/:id/cover from a bundled image. */
export async function presetCoverBody(source: number): Promise<FormData> {
  const asset = Asset.fromModule(source);
  const body = new FormData();
  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    if (!response.ok) throw Error("Không đọc được ảnh bìa mẫu.");
    body.append("file", new File([await response.blob()], "cover.jpg", { type: "image/jpeg" }));
  } else {
    await asset.downloadAsync();
    if (!asset.localUri) throw Error("Không đọc được ảnh bìa mẫu.");
    body.append("file", { uri: asset.localUri, type: "image/jpeg", name: "cover.jpg" } as unknown as Blob);
  }
  return body;
}
