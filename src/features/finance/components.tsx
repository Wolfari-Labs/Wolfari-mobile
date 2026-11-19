import { errorMessage } from "@/shared/api/errors";
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../shared/ui/button';
import { DateTimeField } from '../../shared/ui/date-time-field';
import { FormField } from '../../shared/ui/form-field';
import { MoneyField } from '../../shared/ui/money-field';
import { moneyWords } from '../../shared/ui/money-input';
import { FadeInView, Notice, Segments, ui } from '../../shared/ui/journal';
import { Sheet } from '../../shared/ui/sheet';
import { colors, typography } from '../../shared/theme/tokens';
import type { useFinanceCommand } from './use-finance-command';
import { ReceiptField } from './receipt-field';

const QUICK_AMOUNTS = [
  { label: '100k', value: '100000' },
  { label: '200k', value: '200000' },
  { label: '500k', value: '500000' },
  { label: '1tr', value: '1000000' },
] as const;

export type Field = {
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
  numeric?: boolean;
  /** VND amount: grouped display and quick amounts. */
  money?: boolean;
  multiline?: boolean;
  receiptFundId?: string;
  options?: { value: string; label: string }[];
  /** Picker instead of typing: DD/MM/YYYY or HH:mm. */
  mode?: 'date' | 'time';
  /** One-tap values shown as chips under a text field. */
  suggestions?: readonly string[];
  /** Hide the field (and keep its value) unless this returns true. */
  visible?: (values: Record<string, string>) => boolean;
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
      setError(errorMessage(e, 'Không thể lưu.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet visible title={form.title} onClose={close} dismissible={!busy}>
      <View style={ui.stack}>
        <Notice>{form.message}</Notice>
        {form.fields.filter((field) => !field.visible || field.visible(values)).map((field) =>
          field.mode ? (
            <DateTimeField
              key={field.key}
              mode={field.mode}
              label={field.label}
              value={values[field.key] ?? ''}
              editable={!busy}
              onChangeText={(v) => setValues((s) => ({ ...s, [field.key]: v }))}
            />
          ) : field.receiptFundId ? (
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
            <View key={field.key} style={{ gap: 8 }}>
              {field.money ? (
                <MoneyField
                  label={field.label}
                  value={values[field.key] ?? ''}
                  placeholder={field.placeholder}
                  editable={!busy}
                  onChangeText={(v) => setValues((s) => ({ ...s, [field.key]: v }))}
                />
              ) : (
                <FormField
                  label={field.label}
                  icon="edit"
                  value={values[field.key]}
                  placeholder={field.placeholder}
                  keyboardType={field.numeric ? 'number-pad' : 'default'}
                  autoCapitalize="none"
                  multiline={field.multiline}
                  editable={!busy}
                  onChangeText={(v) => setValues((s) => ({ ...s, [field.key]: v }))}
                />
              )}
              {!!field.suggestions?.length && (
                <View style={ui.actionRow}>
                  {field.suggestions.map((value) => (
                    <Button
                      key={value}
                      label={value}
                      compact
                      variant={values[field.key]?.toUpperCase() === value ? 'primary' : 'soft'}
                      accessibilityLabel={`${field.label}: ${value}`}
                      disabled={busy}
                      onPress={() => setValues((s) => ({ ...s, [field.key]: value }))}
                    />
                  ))}
                </View>
              )}
              {field.money && (
                <>
                  {moneyWords(values[field.key] ?? '') && (
                    <Text style={[typography.footnote, { color: colors.teal }]}>
                      ≈ {moneyWords(values[field.key] ?? '')} đồng
                    </Text>
                  )}
                  <View style={ui.actionRow}>
                    {QUICK_AMOUNTS.map((preset) => (
                      <Pressable
                        cssInterop={false}
                        key={preset.value}
                        disabled={busy}
                        onPress={() => setValues((s) => ({ ...s, [field.key]: preset.value }))}
                        style={({ pressed }) => [
                          {
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor:
                              values[field.key] === preset.value ? colors.mint : colors.fill,
                            borderWidth: 1,
                            borderColor:
                              values[field.key] === preset.value ? colors.pinGreen : colors.line,
                          },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text
                          style={[
                            typography.footnote,
                            {
                              color:
                                values[field.key] === preset.value ? colors.pinGreen : colors.ink,
                            },
                          ]}
                        >
                          {preset.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
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
          <Text style={typography.body}>{command.pending.label}</Text>
          <Text style={typography.footnote}>
            Giữ nguyên nội dung yêu cầu khi gửi lại. Không tạo giao dịch thay thế.
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
                Nếu chưa nhận được kết quả, tải lại danh sách và kiểm tra tuyến, ngưỡng giá,
                trạng thái trước khi đóng yêu cầu này. Yêu cầu trước vẫn có thể đã được lưu.
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
export function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <FadeInView>
      <View style={ui.card}>
        <View style={ui.recordHeader}>
          <Text style={typography.headline}>{title}</Text>
          {right}
        </View>
        {children}
      </View>
    </FadeInView>
  );
}
export function Line({ children }: { children: ReactNode }) {
  return (
    <Text selectable style={typography.body}>
      {children}
    </Text>
  );
}
