export function QrImage({ url, onError, label = "Mã VietQR" }: { url: string; onError(): void; label?: string }) {
  // Data URI rendered by the backend; no request leaves the app. Referrer policy kept defensively.
  return <img src={url} alt={label} referrerPolicy="no-referrer" onError={onError} style={{ width: "100%", height: 280, objectFit: "contain" }} />;
}
