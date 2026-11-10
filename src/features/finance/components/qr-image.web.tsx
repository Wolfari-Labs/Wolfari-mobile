export function QrImage({ url, onError, label = "VietQR TEST" }: { url: string; onError(): void; label?: string }) {
  // The QR URL contains account/amount/reference. Do not send the app's referrer.
  return <img src={url} alt={label} referrerPolicy="no-referrer" onError={onError} style={{ width: "100%", height: 280, objectFit: "contain" }} />;
}
