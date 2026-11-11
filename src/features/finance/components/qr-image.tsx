import { Image } from "expo-image";
export function QrImage({ url, onError, label = "VietQR TEST" }: { url: string; onError(): void; label?: string }) {
  return <Image source={{ uri: url }} cachePolicy="none" contentFit="contain" style={{ width: "100%", height: 280 }} accessibilityLabel={label} onError={onError} />;
}
