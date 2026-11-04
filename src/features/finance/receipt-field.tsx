import { useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApi } from '../../shared/api/use-api';
import { Button } from '../../shared/ui/button';
import { Notice } from '../../shared/ui/journal';
export function ReceiptField({
  fundId,
  value,
  onChange,
  disabled,
  onBusy,
}: {
  fundId: string;
  value: string;
  onChange: (key: string) => void;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const api = useApi(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  async function choose() {
    if (busy || disabled) return;
    setBusy(true);
    onBusy(true);
    setError(undefined);
    try {
      const selected = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (selected.canceled) return;
      const image = selected.assets[0];
      const mime =
        image.mimeType ??
        (/\.png(?:\?|$)/i.test(image.uri)
          ? 'image/png'
          : /\.jpe?g(?:\?|$)/i.test(image.uri)
            ? 'image/jpeg'
            : '');
      if (
        !['image/png', 'image/jpeg'].includes(mime) ||
        (image.fileSize ?? image.file?.size ?? 0) > 10 * 1024 * 1024
      )
        throw Error('Chọn ảnh JPG/PNG tối đa 10 MB. Ảnh HEIC cần chuyển sang JPG trước.');
      const body = new FormData();
      if (Platform.OS === 'web') {
        if (!image.file) throw Error('Không đọc được tệp ảnh.');
        body.append('file', image.file);
      } else
        body.append('file', {
          uri: image.uri,
          type: mime,
          name: mime === 'image/png' ? 'receipt.png' : 'receipt.jpg',
        } as unknown as Blob);
      const result = await api.request<{ object_key: string }>(
        `/funds/${encodeURIComponent(fundId)}/receipts`,
        { method: 'POST', body },
      );
      if (!result.object_key?.startsWith(`funds/${fundId}/receipts/`))
        throw Error('Ảnh trả về không thuộc quỹ này.');
      onChange(result.object_key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được ảnh.');
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <>
      <Button
        label={value ? 'Đổi ảnh chứng từ' : 'Đính kèm ảnh chứng từ (tùy chọn)'}
        variant="soft"
        loading={busy}
        disabled={disabled}
        onPress={() => {
          void choose();
        }}
      />
      {value && (
        <>
          <Notice>Ảnh đã tải lên. Chứng từ không tự xác nhận thanh toán.</Notice>
          <Button
            label="Bỏ ảnh khỏi yêu cầu"
            variant="soft"
            disabled={disabled || busy}
            onPress={() => onChange('')}
          />
        </>
      )}
      {error && <Notice>{error}</Notice>}
    </>
  );
}
