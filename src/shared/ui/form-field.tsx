import { useEffect, useState, type Ref } from "react";
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextInputInstance,
} from "react-native";

import { colors, fonts, radii, typography } from "@/shared/theme/tokens";
import { DesignIcon } from "./design-icon";
import type { DesignIconName } from "./design-assets";

type Props = TextInputProps & {
  label: string;
  icon: DesignIconName;
  error?: string;
  ref?: Ref<TextInputInstance>;
};

export function FormField({
  label,
  icon,
  error,
  ref,
  onFocus,
  onBlur,
  style,
  secureTextEntry,
  ...input
}: Props) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  useEffect(() => {
    if (!secureTextEntry) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") setPasswordVisible(false);
    });
    return () => subscription.remove();
  }, [secureTextEntry]);
  return (
    <View style={styles.field}>
      <Text style={[typography.body, styles.label]}>{label}</Text>
      <View
        collapsable={false}
        style={[
          styles.inputContainer,
          input.multiline && styles.multilineContainer,
          input.editable === false && styles.disabled,
          focused && styles.focused,
          error && styles.invalid,
        ]}
      >
        <View style={styles.icon}>
          <DesignIcon name={icon} size={18} tintColor={colors.teal} />
        </View>
        <TextInput
          {...input}
          secureTextEntry={!!secureTextEntry && !passwordVisible}
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholderTextColor={colors.muted}
          selectionColor={colors.teal}
          style={[
            typography.body,
            styles.input,
            input.multiline && styles.multiline,
            style,
          ]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {secureTextEntry && (
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel={`${passwordVisible ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`}
            accessibilityState={{ disabled: input.editable === false }}
            disabled={input.editable === false}
            onPress={() => setPasswordVisible((value) => !value)}
            style={({ pressed }) => [
              styles.visibility,
              pressed && { backgroundColor: colors.fill },
            ]}
          >
            <DesignIcon
              name={passwordVisible ? "eyeOff" : "eye"}
              size={22}
              tintColor={colors.ink}
            />
          </Pressable>
        )}
      </View>
      {error && (
        <Text
          accessibilityRole="alert"
          style={[typography.footnote, styles.error]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  visibility: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  field: { gap: 8 },
  label: { minHeight: 20, fontSize: 13, lineHeight: 20, fontFamily: fonts.bold, color: colors.muted },
  inputContainer: {
    minHeight: 54,
    borderRadius: radii.control,
    backgroundColor: colors.fill,
    borderWidth: 2,
    borderColor: "transparent",
    // Focus only deepens the ink. Never toggle transform/shadow/transition here:
    // restructuring the native view under a focused TextInput drops focus and
    // makes the keyboard open and close in a loop.
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: { width: 32, height: 32, borderRadius: 12, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    paddingVertical: 10,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  multilineContainer: { alignItems: "flex-start", paddingTop: 14 },
  multiline: { minHeight: 104, paddingTop: 0, textAlignVertical: "top" },
  disabled: { opacity: 0.55 },
  focused: { borderColor: colors.blue, backgroundColor: colors.surface },
  invalid: { borderColor: colors.error },
  error: { color: colors.error },
});
