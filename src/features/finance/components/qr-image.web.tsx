export function QrImage({ url, onError }: { url: string; onError(): void }) {
  // The QR URL contains account/amount/reference. Do not send the app's referrer.
  return <img src={url} alt="VietQR TEST" referrerPolicy="no-referrer" onError={onError} style={{ width: "100%", height: 280, objectFit: "contain" }} />;
}
