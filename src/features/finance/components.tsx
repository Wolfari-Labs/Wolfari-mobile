import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../shared/ui/button';
import { FormField } from '../../shared/ui/form-field';
import { Notice, Segments, ui } from '../../shared/ui/journal';
import { Sheet } from '../../shared/ui/sheet';
import { typography } from '../../shared/theme/tokens';
import type { useFinanceCommand } from './use-finance-command';
import { ReceiptField } from './receipt-field';
export type Field = {
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
  numeric?: boolean;
  multiline?: boolean;
  receiptFundId?: string;
  options?: { value: string; label: string }[];
};
export type ActionForm = {
  title: string;
  message: string;
  fields: Field[];
  submit: (values: Record<string, string>) => Promise<boolean | undefined>;
};
export function ActionSheet({ form, close }: { form: ActionForm; close: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(form.fields.map((f) => [f.key, f.value ?? ''])),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      if (await form.submit(values)) close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet visible title={form.title} onClose={close} dismissible={!busy}>
      <View style={ui.stack}>
        <Notice>{form.message}</Notice>
        {form.fields.map((field) =>
          field.receiptFundId ? (
            <ReceiptField
              key={field.key}
              fundId={field.receiptFundId}
              value={values[field.key]}
              disabled={busy}
              onBusy={setBusy}
              onChange={(value) => setValues((s) => ({ ...s, [field.key]: value }))}
            />
          ) : field.options ? (
            <View key={field.key}>
              <Text style={typography.body}>{field.label}</Text>
              <Segments
                scroll
                items={field.options}
                value={values[field.key]}
                onChange={(v) => !busy && setValues((s) => ({ ...s, [field.key]: v }))}
              />
            </View>
          ) : (
            <FormField
              key={field.key}
              label={field.label}
              icon={field.numeric ? 'wallet' : 'edit'}
              value={values[field.key]}
              placeholder={field.placeholder}
              keyboardType={field.numeric ? 'number-pad' : 'default'}
              autoCapitalize="none"
              multiline={field.multiline}
              editable={!busy}
              onChangeText={(v) => setValues((s) => ({ ...s, [field.key]: v }))}
            />
          ),
        )}
        {!!error && <Notice>{error}</Notice>}
        <Button
          label="Xác nhận lưu"
          loading={busy}
          onPress={() => {
            void submit();
          }}
        />
      </View>
    </Sheet>
  );
}
export function CommandFeedback({ command }: { command: ReturnType<typeof useFinanceCommand> }) {
  const [checked, setChecked] = useState(false);
  return (
    <>
      {command.message && <Notice>{command.message}</Notice>}
      {command.pending && (
        <View style={ui.card}>
          <Text style={typography.headline}>Yêu cầu chưa có kết quả cuối</Text>
          <Text selectable style={typography.body}>
            {command.pending.label} · {command.pending.key}
          </Text>
          <Text style={typography.footnote}>
            Giữ nguyên nội dung và mã yêu cầu khi gửi lại. Không tạo giao dịch thay thế.
          </Text>
          <Button
            label="Gửi lại yêu cầu đã lưu"
            disabled={command.busy}
            onPress={() => {
              void command.retry();
            }}
          />
          {command.pending.kind === 'finance' ? (
            <Button
              label="Kiểm tra trạng thái xử lý"
              disabled={command.busy}
              variant="soft"
              onPress={() => {
                void command.check();
              }}
            />
          ) : (
            <>
              <Notice>
                Nếu gặp xung đột sau mất phản hồi, tải lại danh sách và đối chiếu tuyến, ngưỡng,
                trạng thái trước khi đóng yêu cầu này. Không coi lỗi 409 là giao dịch thất bại.
              </Notice>
              <Button
                label={
                  checked ? 'Đã đối chiếu, đóng yêu cầu' : 'Tôi đã tải lại và đối chiếu danh sách'
                }
                disabled={command.busy}
                variant="soft"
                onPress={() => {
                  if (checked) {
                    void command.acknowledgeWatch();
                    setChecked(false);
                  } else setChecked(true);
                }}
              />
            </>
          )}
        </View>
      )}
    </>
  );
}
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={ui.card}>
      <Text style={typography.headline}>{title}</Text>
      {children}
    </View>
  );
}
export function Line({ children }: { children: ReactNode }) {
  return (
    <Text selectable style={typography.body}>
      {children}
    </Text>
  );
}
