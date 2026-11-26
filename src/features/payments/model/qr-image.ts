import { scanFromURLAsync } from "expo-camera";
import * as ImagePicker from "expo-image-picker";

/**
 * Reads a QR code from a picture on the device (a screenshot of a bank app's "receive money" QR,
 * a photo of a printed one). The image is decoded on the device and never uploaded.
 * Returns the QR text, `undefined` when the person cancelled, or throws a Vietnamese message.
 */
export async function readQrFromImage(): Promise<string | undefined> {
  let picked: ImagePicker.ImagePickerResult;
  try {
    picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: false, allowsMultipleSelection: false });
  } catch {
    throw new Error("Không mở được thư viện ảnh. Hãy kiểm tra quyền truy cập ảnh rồi thử lại.");
  }
  if (picked.canceled || !picked.assets[0]) return undefined;
  const uri = picked.assets[0].uri;
  let codes: { data: string }[];
  try {
    codes = await scanFromURLAsync(uri, ["qr"]);
  } catch {
    throw new Error("Không đọc được ảnh này. Hãy chọn ảnh chụp màn hình mã QR rõ nét.");
  } finally {
    if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
  }
  const code = codes.find(item => item.data?.trim());
  if (!code) throw new Error("Không tìm thấy mã QR trong ảnh. Hãy chọn ảnh có mã QR rõ, không bị cắt hay che.");
  return code.data;
}
