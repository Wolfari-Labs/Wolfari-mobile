import type { ComponentProps } from "react";
import { StyleSheet, Text } from "react-native";

import { colors, fonts } from "@/shared/theme/tokens";
import { FormField } from "./form-field";
import { groupMoney, moneyDigits } from "./money-input";

type Props = Omit<ComponentProps<typeof FormField>, "icon" | "keyboardType" | "maxLength"> & {
  value: string;
  onChangeText: (digits: string) => void;
  maxDigits?: number;
};

/** Shows "1.500.000 ₫" while typing; reports only the digits back. */
export function MoneyField({ value, onChangeText, maxDigits = 19, placeholder = "0", ...props }: Props) {
  return (
    <FormField
      {...props}
      icon="wallet"
      value={groupMoney(value)}
      onChangeText={(text) => onChangeText(moneyDigits(text, maxDigits))}
      keyboardType="number-pad"
      inputMode="numeric"
      autoCapitalize="none"
      placeholder={placeholder}
      maxLength={maxDigits + Math.floor((maxDigits - 1) / 3)}
      style={styles.input}
      accessory={<Text style={styles.currency}>₫</Text>}
    />
  );
}

const styles = StyleSheet.create({
  input: { fontFamily: fonts.bold, fontSize: 18, fontVariant: ["tabular-nums"] },
  currency: { color: colors.muted, fontSize: 18, fontFamily: fonts.bold, paddingRight: 4 },
});
