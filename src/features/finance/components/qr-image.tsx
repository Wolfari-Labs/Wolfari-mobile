import { Image } from "expo-image";
export function QrImage({ url, onError }: { url: string; onError(): void }) {
  return <Image source={{ uri: url }} cachePolicy="none" contentFit="contain" style={{ width: "100%", height: 280 }} accessibilityLabel="VietQR TEST" onError={onError} />;
}
