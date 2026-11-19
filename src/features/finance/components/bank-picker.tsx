import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, typography } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { FormField } from '@/shared/ui/form-field';
import { ui } from '@/shared/ui/journal';
import { bankDisplayName } from '../bank-names';
import { resolveVietQrBank, VIETQR_BANKS } from '../vietqr-banks';

const popular = ['VCB', 'TCB', 'MB', 'ACB', 'BIDV', 'ICB', 'VPB', 'TPB', 'STB', 'VIB'];
const searchable = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/gi, 'd').toLowerCase();
const banks = [...VIETQR_BANKS].sort((a, b) => {
  const first = popular.indexOf(a.code), second = popular.indexOf(b.code);
  return (first < 0 ? 100 : first) - (second < 0 ? 100 : second) || bankDisplayName(a.code).localeCompare(bankDisplayName(b.code), 'vi');
});

export function BankPicker({ value, onChange, disabled }: { value: string; onChange(value: string): void; disabled: boolean }) {
  const [query, setQuery] = useState(''), [limit, setLimit] = useState(6);
  const selected = resolveVietQrBank(value);
  const results = banks.filter(bank => searchable(`${bankDisplayName(bank.code)} ${bank.code} ${bank.bin}`).includes(searchable(query.trim())));
  return <View style={ui.stack}>
    <Text accessibilityRole="header" style={typography.headline}>Ngân hàng nhận</Text>
    {selected && <Text style={typography.body}>Đã chọn: {bankDisplayName(selected.code)}</Text>}
    <FormField icon="wallet" label="Tìm ngân hàng" placeholder="Nhập tên ngân hàng" value={query}
      onChangeText={text => { setQuery(text); setLimit(6); }} editable={!disabled} autoCorrect={false} />
    <View accessibilityRole="radiogroup" accessibilityLabel="Chọn ngân hàng nhận" style={ui.stack}>
      {results.slice(0, limit).map(bank => <Pressable cssInterop={false} key={bank.code} accessibilityRole="radio"
        accessibilityLabel={bankDisplayName(bank.code)} accessibilityState={{ checked: selected?.code === bank.code, disabled }} aria-checked={selected?.code === bank.code} aria-disabled={disabled} disabled={disabled}
        onPress={() => onChange(bank.code)} style={[ui.card, { minHeight: 48, borderWidth: 1, borderColor: selected?.code === bank.code ? colors.teal : colors.line }]}>
        <Text style={typography.body}>{selected?.code === bank.code ? '✓ ' : ''}{bankDisplayName(bank.code)}</Text>
      </Pressable>)}
    </View>
    {!results.length && <Text style={typography.footnote}>Không tìm thấy ngân hàng. Thử tên khác hoặc mã ngân hàng.</Text>}
    {results.length > limit && <Button label="Xem thêm ngân hàng" variant="text" compact disabled={disabled} onPress={() => setLimit(current => current + 6)} />}
  </View>;
}
