import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { Screen } from "@/shared/ui/screen";
import { authApi } from "../api/auth.api";
import { authErrorMessage } from "../auth-errors";
import { validateRegistration, type AuthFieldErrors } from "../validation";

export default function SignUpScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const confirmationInput = useRef<TextInput>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function clearFieldError(field: keyof AuthFieldErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
  }

  async function submit() {
    if (submitting.current) return;
    const fieldErrors = validateRegistration(fullName, email, password, confirmation);
    setErrors(fieldErrors);
    setConsentError(!consent);
    setError(null);
    if (Object.keys(fieldErrors).length || !consent) return;
    submitting.current = true;
    setLoading(true);
    Keyboard.dismiss();
    try {
      const response = await authApi.register({ full_name: fullName, email, password });
      if (response.message_code !== "REQUEST_ACCEPTED") throw new Error("Unexpected registration response.");
      if (mounted.current) {
        setPassword("");
        setConfirmation("");
        setAccepted(true);
      }
    } catch (cause) {
      if (mounted.current) setError(authErrorMessage(cause));
    } finally {
      submitting.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <Screen title="Tạo tài khoản">
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={typography.title}>{"Cùng Wolfari\nlên đường"}</Text>
        <Text style={[typography.body, styles.muted]}>Lưu kế hoạch và kết nối với nhóm bạn.</Text>
      </View>
      <FormField label="Họ và tên" icon="edit" placeholder="Nguyễn Minh Anh" value={fullName} editable={!loading} error={errors.full_name} autoComplete="name" textContentType="name" autoCapitalize="words" maxLength={150} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailInput.current?.focus()} onChangeText={(value) => { setFullName(value); clearFieldError("full_name"); }} />
      <FormField ref={emailInput} label="Email" icon="mail" placeholder="name@example.com" value={email} editable={!loading} error={errors.email} autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={255} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordInput.current?.focus()} onChangeText={(value) => { setEmail(value); clearFieldError("email"); }} />
      <FormField ref={passwordInput} label="Mật khẩu" icon="lock" placeholder="15–128 ký tự" value={password} editable={!loading} error={errors.password} secureTextEntry autoComplete="new-password" textContentType="newPassword" autoCapitalize="none" autoCorrect={false} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => confirmationInput.current?.focus()} onChangeText={(value) => { setPassword(value); clearFieldError("password"); }} />
      <FormField ref={confirmationInput} label="Nhập lại mật khẩu" icon="lock" placeholder="Nhập lại mật khẩu" value={confirmation} editable={!loading} error={errors.confirm_password} secureTextEntry autoComplete="new-password" textContentType="newPassword" autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={() => { void submit(); }} onChangeText={(value) => { setConfirmation(value); clearFieldError("confirm_password"); }} />
      <Pressable accessibilityRole="checkbox" accessibilityLabel="Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật" accessibilityState={{ checked: consent, disabled: loading }} disabled={loading} onPress={() => { setConsent((current) => !current); setConsentError(false); }} style={styles.consent}>
        <View style={[styles.checkbox, consent && styles.checked]}>{consent && <DesignIcon name="check" />}</View>
        <Text style={[typography.footnote, styles.consentCopy]}>{"Tôi đồng ý với Điều khoản sử dụng\nvà Chính sách bảo mật."}</Text>
      </Pressable>
      {consentError && <Text accessibilityRole="alert" style={[typography.footnote, styles.error]}>Vui lòng đồng ý với điều khoản trước khi tạo tài khoản.</Text>}
      {error && <Feedback message={error} />}
      <Button label="Tạo tài khoản" loading={loading} onPress={() => { void submit(); }} />
      <Pressable disabled={loading} accessibilityRole="link" onPress={() => router.replace("/sign-in")}>
        <Text style={[typography.body, styles.link]}>Đã có tài khoản?  Đăng nhập →</Text>
      </Pressable>
      <Modal visible={accepted} transparent animationType="fade" onRequestClose={() => setAccepted(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={typography.section}>Kiểm tra email của bạn</Text>
            <Text style={[typography.body, styles.muted]}>Yêu cầu đăng ký đã được tiếp nhận. Hãy kiểm tra email để xác minh tài khoản, hoặc đăng nhập nếu bạn đã có tài khoản.</Text>
            <Button label="Xác minh email" variant="soft" onPress={() => router.push("/verify-email")} />
            <Button label="Đăng nhập" onPress={() => { setAccepted(false); router.replace("/sign-in"); }} />
            <Button label="Đóng" variant="soft" onPress={() => setAccepted(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 6 },
  muted: { color: colors.muted },
  consent: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 36 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  checked: { backgroundColor: colors.teal, borderWidth: 0 },
  consentCopy: { flex: 1 },
  link: { color: colors.teal, fontWeight: "600" },
  error: { color: colors.error },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(9,33,41,0.4)", padding: 24 },
  modalCard: { width: "100%", maxWidth: 354, backgroundColor: colors.surface, borderRadius: radii.card, padding: 24, gap: 16 },
});
