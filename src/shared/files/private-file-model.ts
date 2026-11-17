export const privateFileTypes = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;
export function privateFileName(blob: Blob, name: string) {
  const extension = privateFileTypes[blob.type as keyof typeof privateFileTypes];
  if (!extension || blob.size < 1 || blob.size > 10 * 1024 * 1024)
    throw Error("Chỉ mở PDF/JPG/PNG tối đa 10 MB.");
  const clean = name.replace(/\.[^.]*$/, "").replace(/[^\w-]/g, "-").slice(0, 100);
  return `${clean || "wolfari-file"}.${extension}`;
}
export function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error("Không đọc được tệp."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(Error("Không đọc được tệp."));
    reader.readAsDataURL(blob);
  });
}
