import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Text } from "react-native";

import { ApiError } from "@/shared/api/api-client";
import { apiClient } from "@/shared/api/client";
import { useApi } from "@/shared/api/use-api";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { Heading } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { accountToken, isEmailCode, passwordError } from "../account-validation";
import { createAccountApi } from "../api/account.api";
import { authErrorMessage } from "../auth-errors";
import { CodeField } from "../components/code-field";
import { useSession } from "../session/session-provider";
import { AuthGate } from "../session/auth-gate";
import { validateLogin } from "../validation";
import { useAccountLink } from "../use-account-link";
import { useResendCooldown } from "../use-resend-cooldown";

const publicApi = createAccountApi(apiClient);
export default function PasswordScreen({ mode }: { mode: "request" | "reset" | "change" }) {
  const api = useApi();
  const { clearLocalSession, status } = useSession();
  const params = useLocalSearchParams<{ email?: string; sent?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [code, setCode] = useState("");
  const [token, setToken] = useAccountLink();
  const [manualLink, setManualLink] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [finished, setFinished] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const cooldown = useResendCooldown(60, params.sent === "1");
  const locked = useRef(false);
  const linkMode = mode === "reset" && (manualLink || !!token);
  const title = mode === "request" ? "Quên mật khẩu" : mode === "reset" ? "Đặt lại mật khẩu" : "Đổi mật khẩu";
  const editable = !busy && !uncertain && !finished;

  async function requestCode(target: string) {
    await publicApi.requestReset(target);
    cooldown.start();
  }
  async function submit() {
    if (locked.current || uncertain || finished) return;
    const invalidEmail = mode === "request" || (mode === "reset" && !linkMode) ? validateLogin(email, "unused").email : undefined;
    if (invalidEmail) { setError(invalidEmail); return; }
    if (mode === "reset" && !linkMode && !isEmailCode(code)) { setError("Nhập đủ 6 số trong email khôi phục."); return; }
    const parsed = accountToken(token);
    if (linkMode && !parsed) { setError("Dán liên kết đặt lại mật khẩu trong email."); return; }
    if (mode !== "request") {
      const invalid = passwordError(password, confirmation);
      if (invalid) { setError(invalid); return; }
    }
    if (mode === "change" && !current) { setError("Nhập mật khẩu hiện tại."); return; }
    locked.current = true; setBusy(true); setError(undefined);
    let passwordSaved = false;
    try {
      if (mode === "request") {
        // The same 202 answers every email, so always continue to the code step.
        await requestCode(email);
        router.push({ pathname: "/reset-password", params: { email: email.trim().toLowerCase(), sent: "1" } });
        return;
      }
      if (mode === "reset") {
        if (linkMode) await publicApi.resetPassword(parsed!, password);
        else await publicApi.resetPasswordWithCode(email, code, password);
      } else await api.account.changePassword(current, password);
      passwordSaved = true;
      setCurrent(""); setPassword(""); setConfirmation(""); setToken(""); setCode("");
      setFinished(true);
      // Both backend operations revoke every session, including this device.
      await clearLocalSession();
      router.replace({ pathname: "/sign-in", params: { notice: "password-updated" } });
    } catch (cause) {
      // A timeout, broken response or server error can arrive after the write.
      // Password changes have no idempotency key; never offer a blind retry.
      if (mode !== "request" && (!(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500 || cause.code === "INVALID_RESPONSE")) {
        setUncertain(true);
        setCurrent(""); setPassword(""); setConfirmation(""); setToken(""); setCode("");
        setError(passwordSaved
          ? "Mật khẩu đã đổi trên máy chủ nhưng chưa xóa xong phiên trên thiết bị. Chọn đến trang đăng nhập để thử dọn phiên lại."
          : "Chưa xác định được mật khẩu đã đổi hay chưa. Hãy thử đăng nhập bằng mật khẩu mới; nếu không được, yêu cầu mã khôi phục mới. Không gửi lại yêu cầu đổi mật khẩu.");
        return;
      }
      setError(mode === "change" && cause instanceof ApiError && cause.status === 401
        ? "Mật khẩu hiện tại chưa đúng hoặc phiên đăng nhập đã hết hạn."
        : mode === "reset" && cause instanceof ApiError && cause.status === 400
          ? linkMode
            ? "Liên kết đã hết hạn, đã dùng hoặc mật khẩu chưa hợp lệ. Hãy yêu cầu mã mới nếu cần."
            : "Mã chưa đúng hoặc đã hết hạn. Kiểm tra email mới nhất; sai 5 lần thì cần gửi lại mã."
          : authErrorMessage(cause));
    } finally { locked.current = false; setBusy(false); }
  }
  async function resend() {
    if (locked.current) return;
    const invalid = validateLogin(email, "unused").email;
    if (invalid) { setError(invalid); return; }
    locked.current = true; setBusy(true); setError(undefined);
    try { await requestCode(email); setResent(true); setCode(""); }
    catch (cause) { setError(authErrorMessage(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  // Keep the completed flow mounted during local cleanup; a surrounding AuthGate
  // would race the success navigation and replace its sign-in notice.
  if (mode === "change" && status !== "authenticated" && !finished) return <AuthGate><Text /></AuthGate>;
  const emailField = <FormField icon="mail" label="Email" value={email} onChangeText={value => { setEmail(value); setError(undefined); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={editable} maxLength={255} />;
  return <Screen title={title}>
    <Heading
      title={title}
      subtitle={mode === "request"
        ? "Nhập email tài khoản, Wolfari sẽ gửi mã khôi phục 6 số."
        : mode === "reset" && !linkMode
          ? email ? `Nhập mã 6 số đã gửi tới ${email.trim()} và mật khẩu mới.` : "Nhập email, mã 6 số trong email và mật khẩu mới."
          : "Mật khẩu mới cần từ 8 đến 128 ký tự."}
    />
    {error && <Feedback message={error} />}
    {resent && <Feedback success message="Đã gửi lại mã. Mã cũ không còn dùng được; kiểm tra cả thư mục thư rác." />}
    {mode === "request" ? emailField : <>
      {mode === "reset" && !linkMode && <>
        {!params.email && emailField}
        <CodeField label="Mã khôi phục 6 số" value={code} onChange={value => { setCode(value); setError(undefined); }} editable={editable} invalid={!!error} />
      </>}
      {linkMode && <FormField icon="mail" label="Mã hoặc liên kết đặt lại mật khẩu" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} editable={editable} />}
      {mode === "change" && <FormField icon="lock" label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" editable={editable} />}
      <FormField icon="lock" label="Mật khẩu mới" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={editable} />
      <FormField icon="lock" label="Nhập lại mật khẩu mới" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={editable} />
      <Text style={typography.footnote}>Sau khi lưu, tất cả phiên đăng nhập sẽ bị thu hồi. Bạn cần đăng nhập lại bằng mật khẩu mới.</Text>
    </>}
    <Button label={mode === "request" ? "Gửi mã khôi phục" : "Lưu mật khẩu mới"} loading={busy} disabled={uncertain || finished} onPress={() => { void submit(); }} />
    {uncertain && <Button label="Đến trang đăng nhập" variant="soft" onPress={() => { setFinished(true); void clearLocalSession().then(() => router.replace("/sign-in")).catch(cause => { setFinished(false); setError(authErrorMessage(cause)); }); }} />}
    {mode === "request" && <Button label="Tôi đã có mã khôi phục" variant="soft" disabled={busy} onPress={() => router.push({ pathname: "/reset-password", params: email.trim() ? { email: email.trim().toLowerCase() } : {} })} />}
    {mode === "reset" && !linkMode && <Button label={cooldown.left ? `Gửi lại mã sau ${cooldown.left} giây` : "Gửi lại mã"} variant="text" disabled={busy || cooldown.left > 0 || uncertain || finished} onPress={() => { void resend(); }} />}
    {mode === "reset" && <Button label={linkMode ? "Nhập mã 6 số" : "Dùng liên kết trong email"} variant="text" disabled={busy || uncertain || finished} onPress={() => { setManualLink(!linkMode); setToken(""); setError(undefined); }} />}
  </Screen>;
}
