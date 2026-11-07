import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useApi } from "@/shared/api/use-api";
import { errorMessage } from "@/shared/api/errors";
import type { OperationCommand } from "@/shared/operations/controller";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Notice, ui } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import type { PaymentQr } from "@/features/payments/model/payment-qr";
import { QrFill } from "./qr-fill";

export type FormValues = Record<string, string>;
export type FinanceFormSpec = {
  title: string; description: string; initial?: FormValues; destructive?: boolean;
  fields?: { key: string; label: string; numeric?: boolean; multiline?: boolean; max?: number;
    mode?: "date" | "time";
    options?: { value: string; label: string }[]; multiple?: boolean }[];
  receipt?: { fundId: string; field: "receipt_object_key" | "evidence_object_key" };
  /** Optional on-device VietQR reader that pre-fills fields; `fill` throws a user-facing message on mismatch. */
  scan?: { label: string; fill(payment: PaymentQr): FormValues };
  build(values: FormValues): OperationCommand;
};

export function FinanceForm({ spec, busy, onSubmit, onClose }: {
  spec: FinanceFormSpec; busy: boolean; onSubmit: (command: OperationCommand) => Promise<boolean>; onClose(): void;
}) {
  const api = useApi();
  const [values, setValues] = useState<FormValues>(spec.initial ?? {});
  const [error, setError] = useState<string>();
  const [prepared, setPrepared] = useState<OperationCommand>();
  const [working, setWorking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [filled, setFilled] = useState(false);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
  const assetRef = useRef<ImagePicker.ImagePickerAsset | undefined>(undefined);
  const active = useRef(true), lock = useRef(false), uploaded = useRef<string | undefined>(undefined);
  const disabled = busy || working;
  const release = (asset?: ImagePicker.ImagePickerAsset) => {
    if (Platform.OS === "web" && asset?.uri.startsWith("blob:")) URL.revokeObjectURL(asset.uri);
  };
  useEffect(() => { active.current = true; return () => { active.current = false; release(assetRef.current); }; }, []);
  const set = (key: string, value: string) => setValues(current => ({ ...current, [key]: value }));
  async function choose() {
    if (lock.current || disabled) return;
    lock.current = true; setWorking(true); setError(undefined);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!active.current) { release(asset); return; }
      if (!asset.mimeType || !["image/jpeg", "image/png"].includes(asset.mimeType) || (asset.fileSize ?? asset.file?.size ?? 0) > 10 * 1024 * 1024 || asset.width * asset.height > 10_000_000) {
        release(asset); throw new Error("Chọn JPEG/PNG tối đa 10 MiB và 10 triệu pixel. Máy chủ sẽ kiểm tra lại nội dung ảnh.");
      }
      release(assetRef.current); assetRef.current = asset; uploaded.current = undefined; setPhoto(asset);
    } catch (cause) { if (active.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (active.current) setWorking(false); }
  }
  async function prepare() {
    if (lock.current || disabled) return;
    lock.current = true; setWorking(true); setError(undefined);
    try {
      // Validate all business fields before uploading a temporary private file.
      const command = spec.build(values);
      if (photo && spec.receipt) {
        if (!uploaded.current) {
          const form = new FormData();
          if (Platform.OS === "web") {
            if (!photo.file) throw new Error("Không đọc được ảnh. Hãy chọn lại.");
            form.append("file", photo.file);
          } else form.append("file", { uri: photo.uri, type: photo.mimeType, name: photo.mimeType === "image/png" ? "receipt.png" : "receipt.jpg" } as unknown as Blob);
          uploaded.current = (await api.finance.uploadReceipt(spec.receipt.fundId, form)).object_key;
        }
        command.body[spec.receipt.field] = uploaded.current;
      }
      if (active.current) setPrepared({ ...command, title: spec.title });
    } catch (cause) { if (active.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (active.current) setWorking(false); }
  }
  async function submit() {
    if (!prepared || lock.current || disabled) return;
    lock.current = true; setWorking(true);
    try { if (await onSubmit(prepared)) onClose(); }
    finally { lock.current = false; if (active.current) setWorking(false); }
  }
  return <Sheet visible title={prepared ? "Xác nhận thao tác" : spec.title} dismissible={!disabled} onClose={() => { if (!disabled) onClose(); }}>
    <Text style={typography.headline}>{spec.title}</Text>
    <Notice>{spec.description}</Notice>
    {error && <Feedback message={error} />}
    {!prepared && spec.scan && (scanning
      ? <QrFill onClose={() => setScanning(false)} onRead={payment => {
        try { const next = spec.scan!.fill(payment); setValues(current => ({ ...current, ...next })); setScanning(false); setFilled(true); setError(undefined); return undefined; }
        catch (cause) { return errorMessage(cause); }
      }} />
      : <Button label={spec.scan.label} icon="wallet" variant="soft" disabled={disabled} onPress={() => { setFilled(false); setScanning(true); }} />)}
    {filled && !prepared && <Feedback success message="Đã điền từ VietQR. Kiểm tra lại từng trường trước khi tiếp tục." />}
    {spec.fields?.map(field => prepared ? <View key={field.key} style={ui.stack}>
      <Text style={typography.footnote}>{field.label}</Text>
      <Text selectable style={typography.body}>{field.options ? field.options.filter(option => (values[field.key] ?? "").split(",").includes(option.value)).map(option => option.label).join(" · ") || "Không chọn" : values[field.key] || "Để trống"}</Text>
    </View> : field.options ? <View key={field.key} style={ui.stack}>
      <Text style={typography.headline}>{field.label}</Text>
      {!field.options.length && <Notice>Chưa có lựa chọn hợp lệ. Kiểm tra thành viên hoặc xác nhận tài khoản nhận trước.</Notice>}
      {field.options.map(option => {
        const selected = (values[field.key] ?? "").split(",").includes(option.value);
        return <Pressable key={option.value} accessibilityRole={field.multiple ? "checkbox" : "radio"} accessibilityLabel={`${field.label}: ${option.label}`} accessibilityState={{ checked: selected, disabled }} disabled={disabled}
          style={[ui.card, { borderWidth: 1, borderColor: selected ? colors.teal : colors.line, minHeight: 48 }]}
          onPress={() => {
            const current = (values[field.key] ?? "").split(",").filter(Boolean);
            set(field.key, field.multiple ? (selected ? current.filter(value => value !== option.value) : [...current, option.value]).join(",") : option.value);
          }}><Text style={typography.body}>{selected ? "✓ " : "○ "}{option.label}</Text></Pressable>;
      })}
    </View> : field.mode ? <DateTimeField key={field.key} mode={field.mode} label={field.label} value={values[field.key] ?? ""} onChangeText={value => set(field.key, value)} editable={!disabled} /> : <FormField key={field.key} icon={field.numeric ? "wallet" : "edit"} label={field.label} value={values[field.key] ?? ""} onChangeText={value => set(field.key, value)} keyboardType={field.numeric ? "number-pad" : "default"} autoCapitalize="none" maxLength={field.max ?? 1024} multiline={field.multiline} editable={!disabled} />)}
    {photo && <Image source={{ uri: photo.uri }} style={{ height: 180, width: "100%" }} contentFit="contain" cachePolicy="none" accessibilityLabel="Ảnh chứng từ đã chọn" />}
    {!prepared && spec.receipt && <>
      <Button label={photo ? "Đổi ảnh chứng từ" : "Đính kèm ảnh chứng từ"} variant="soft" disabled={disabled} onPress={() => { void choose(); }} />
      {photo && <Button label="Bỏ ảnh đã chọn" variant="soft" disabled={disabled} onPress={() => { release(assetRef.current); assetRef.current = undefined; uploaded.current = undefined; setPhoto(undefined); }} />}
      <Text style={typography.footnote}>JPEG/PNG · tối đa 10 MiB. Ảnh được tải riêng tư khi tiếp tục; chỉ gắn vào giao dịch khi xác nhận. File chưa gắn sẽ được backend dọn sau.</Text>
    </>}
    {prepared ? <>
      <Notice>Đây là ghi nhận nghiệp vụ trên máy chủ, không phải lệnh chuyển tiền ngân hàng. Không xác nhận đã nhận/chi khi chưa đối chiếu tiền thực tế.</Notice>
      <Button label="Xác nhận thực hiện" variant={spec.destructive ? "destructive" : "primary"} loading={disabled} onPress={() => { void submit(); }} />
      <Button label="Quay lại chỉnh sửa" variant="soft" disabled={disabled} onPress={() => setPrepared(undefined)} />
    </> : <Button label="Tiếp tục" loading={disabled} disabled={scanning} onPress={() => { void prepare(); }} />}
  </Sheet>;
}
