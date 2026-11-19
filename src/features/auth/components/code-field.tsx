import { useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from "react-native";

import { colors, fonts, radii } from "@/shared/theme/tokens";
import { EMAIL_CODE_LENGTH, emailCodeInput } from "../account-validation";

/**
 * One real input (so paste, SMS/email autofill and screen readers work) drawn as
 * six boxes. Calls onComplete once the sixth digit arrives.
 */
export function CodeField({ label, value, onChange, onComplete, editable = true, invalid = false }: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  editable?: boolean;
  invalid?: boolean;
}) {
  const input = useRef<TextInputInstance>(null);
  const digits = value.split("");
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable cssInterop={false} accessible={false} onPress={() => input.current?.focus()} style={styles.boxes}>
        {Array.from({ length: EMAIL_CODE_LENGTH }, (_, index) => (
          <View
            key={index}
            style={[
              styles.box,
              index === Math.min(digits.length, EMAIL_CODE_LENGTH - 1) && editable && styles.active,
              invalid && styles.invalid,
            ]}
          >
            <Text style={styles.digit}>{digits[index] ?? ""}</Text>
          </View>
        ))}
        <TextInput
          ref={input}
          accessibilityLabel={label}
          value={value}
          editable={editable}
          onChangeText={(text) => {
            const code = emailCodeInput(text);
            onChange(code);
            if (code.length === EMAIL_CODE_LENGTH && code !== value) onComplete?.(code);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={EMAIL_CODE_LENGTH + 2}
          caretHidden
          selectionColor="transparent"
          style={styles.hidden}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { minHeight: 20, fontSize: 13, lineHeight: 20, fontFamily: fonts.bold, color: colors.muted },
  boxes: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  box: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.85,
    borderRadius: radii.control,
    backgroundColor: colors.fill,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  active: { borderColor: colors.blue, backgroundColor: colors.surface },
  invalid: { borderColor: colors.error },
  digit: { fontSize: 26, fontFamily: fonts.heading, color: colors.ink, fontVariant: ["tabular-nums"] },
  // Covers the boxes so a tap anywhere focuses the real input; text stays invisible.
  hidden: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, color: "transparent", opacity: 0.02, fontSize: 1 },
});
