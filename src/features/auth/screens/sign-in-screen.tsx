import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { Screen } from "@/shared/ui/screen";
import { authErrorMessage } from "../auth-errors";
import { useSession } from "../session/session-provider";
import { validateLogin, type AuthFieldErrors } from "../validation";
import { pendingInvitation } from "@/features/trips/pending-invitation";

export default function SignInScreen() {
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const { signIn, status, profile } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const passwordInput = useRef<TextInput>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function submit() {
    if (submitting.current) return;
    const fieldErrors = validateLogin(email, password);
    setErrors(fieldErrors);
    setError(null);
    if (Object.keys(fieldErrors).length) return;
    submitting.current = true;
    setLoading(true);
    Keyboard.dismiss();
    try {
      await signIn({ email, password });
      if (mounted.current) {
        setPassword("");
        router.replace(pendingInvitation.get() ? "/invitation" : "/(tabs)");
      }
    } catch (cause) {
      if (mounted.current) setError(authErrorMessage(cause));
    } finally {
      submitting.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <Screen title="Đăng nhập">
      <Image source={designAssets.logo} style={styles.logo} contentFit="contain" accessibilityLabel="Wolfari" />
      <View style={styles.welcome}>
        <Text accessibilityRole="header" style={[typography.title, styles.greeting]}>{"Chào mừng\ntrở lại!"}</Text>
        <Image source={designAssets.mascot} style={styles.mascot} contentFit="contain" accessible={false} />
      </View>
      <Text style={[typography.body, styles.muted]}>Tiếp tục những hành trình của bạn.</Text>
      {notice === "password-updated" && <Feedback success message="Đã cập nhật mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới." />}
      {status === "authenticated" && profile ? (
        <>
          <Feedback success message={`Bạn đã đăng nhập với tài khoản ${profile.email}.`} />
          <Button label="Về trang khám phá" onPress={() => router.replace("/")} />
        </>
      ) : (
        <>
          <FormField label="Email" icon="mail" placeholder="name@example.com" value={email} editable={!loading} error={errors.email} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" submitBehavior="submit" maxLength={255}
            onChangeText={(value) => { setEmail(value); setErrors((current) => ({ ...current, email: undefined })); setError(null); }} onSubmitEditing={() => passwordInput.current?.focus()} />
          <FormField ref={passwordInput} label="Mật khẩu" icon="lock" placeholder="••••••••" value={password} editable={!loading} error={errors.password} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => { void submit(); }}
            onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); setError(null); }} />
          {error && <Feedback message={error} />}
          <Button label="Đăng nhập" loading={loading} onPress={() => { void submit(); }} />
          <Button label="Quên mật khẩu?" variant="soft" disabled={loading} onPress={() => router.push("/forgot-password")} />
          <View style={styles.signUpPrompt}>
            <Text style={[typography.body, styles.muted, styles.promptCopy]}>Bạn chưa có tài khoản?</Text>
            <Pressable disabled={loading} accessibilityRole="link" onPress={() => router.replace("/sign-up")}>
              <Text style={[typography.body, styles.link]}>Đăng ký</Text>
            </Pressable>
          </View>
        </>
      )}
      <Image source={designAssets.lake} style={styles.lake} contentFit="cover" accessibilityLabel="Minh họa hồ nước xanh và núi" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 114, height: 38 },
  welcome: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 92 },
  greeting: { flex: 1 },
  mascot: { width: 92, height: 92 },
  muted: { color: colors.muted },
  signUpPrompt: { flexDirection: "row", alignItems: "center", gap: 8 },
  promptCopy: { flex: 1 },
  link: { color: colors.teal, fontWeight: "600", minWidth: 116, textAlign: "left" },
  lake: { height: 150, width: "100%", borderRadius: radii.card },
});
