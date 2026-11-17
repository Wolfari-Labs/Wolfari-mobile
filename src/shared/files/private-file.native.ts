import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { randomUUID } from "../operations/operation-id";
import { blobDataUrl, privateFileName } from "./private-file-model";

/** Files stay in app-private cache; expired copies are removed before the next presentation. */
export async function presentPrivateFile(blob: Blob, name: string, mode: "preview" | "share" = "share") {
  const filename = privateFileName(blob, name);
  const directory = new Directory(Paths.cache, "wolfari-private-files");
  await directory.create({ intermediates: true, idempotent: true });
  for (const item of await directory.list()) {
    if (!(item instanceof File)) continue;
    const info = await item.info();
    if (!info.modificationTime || info.modificationTime < Date.now() - 3_600_000) {
      try { await item.delete(); } catch { /* The OS may have purged the cache already. */ }
    }
  }
  const file = new File(directory, `${randomUUID()}-${filename}`);
  const data = await blobDataUrl(blob);
  await file.write(data.slice(data.indexOf(",") + 1), { encoding: "base64" });
  if (mode === "preview" && await File.canPreview(file, { mimeType: blob.type })) {
    await File.preview(file, { mimeType: blob.type, title: filename });
    return;
  }
  if (!await Sharing.isAvailableAsync()) {
    await file.delete();
    throw Error("Thiết bị chưa có ứng dụng mở/chia sẻ định dạng này.");
  }
  // Android can resolve before the receiving app reads its URI; retain the temporary copy.
  await Sharing.shareAsync(file.uri, { mimeType: blob.type, dialogTitle: filename, UTI: blob.type === "application/pdf" ? "com.adobe.pdf" : blob.type === "image/png" ? "public.png" : "public.jpeg" });
}
