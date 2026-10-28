// ImagePicker returns browser-owned object URLs on web. Native file URIs must
// never be revoked or deleted by this preview.
export function releaseCoverUrl(uri?: string) {
  if (
    uri?.startsWith("blob:") &&
    typeof URL !== "undefined" &&
    typeof URL.revokeObjectURL === "function"
  ) {
    URL.revokeObjectURL(uri);
  }
}
