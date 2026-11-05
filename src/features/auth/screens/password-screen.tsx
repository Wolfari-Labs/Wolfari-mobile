import { router } from "expo-router";
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
import { accountToken, passwordError } from "../account-validation";
import { createAccountApi } from "../api/account.api";
import { authErrorMessage } from "../auth-errors";
import { useSession } from "../session/session-provider";
import { AuthGate } from "../session/auth-gate";
import { validateLogin } from "../validation";
import { useAccountLink } from "../use-account-link";

const publicApi = createAccountApi(apiClient);
export default function PasswordScreen({ mode }: { mode: "request" | "reset" | "change" }) {
  const api = useApi();
  const { clearLocalSession, status } = useSession();
  const [email, setEmail] = useState("");
  const [token, setToken] = useAccountLink();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [finished, setFinished] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  const title = mode === "request" ? "Quên mật khẩu" : mode === "reset" ? "Đặt lại mật khẩu" : "Đổi mật khẩu";
  async function submit() {
    if (locked.current || uncertain || finished) return;
    const invalid = mode === "request" ? validateLogin(email, "unused").email : passwordError(password, confirmation);
    if (invalid) { setError(invalid); return; }
    const parsed = accountToken(token);
    if (mode === "reset" && !parsed) { setError("Dán mã hoặc liên kết đặt lại mật khẩu trong email."); return; }
    if (mode === "change" && !current) { setError("Nhập mật khẩu hiện tại."); return; }
    locked.current = true; setBusy(true); setError(undefined);
    let passwordSaved = false;
    try {
      if (mode === "request") { await publicApi.requestReset(email); setSent(true); }
      else {
        if (mode === "reset") await publicApi.resetPassword(parsed!, password);
        else await api.account.changePassword(current, password);
        passwordSaved = true;
        setCurrent(""); setPassword(""); setConfirmation(""); setToken("");
        setFinished(true);
        // Both backend operations revoke every session, including this device.
        await clearLocalSession();
        router.replace({ pathname: "/sign-in", params: { notice: "password-updated" } });
      }
    } catch (cause) {
      // A timeout, broken response or server error can arrive after the write.
      // Password changes have no idempotency key; never offer a blind retry.
      if (mode !== "request" && (!(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500 || cause.code === "INVALID_RESPONSE")) {
        setUncertain(true);
        setCurrent(""); setPassword(""); setConfirmation(""); setToken("");
        setError(passwordSaved
          ? "Mật khẩu đã đổi trên máy chủ nhưng chưa xóa xong phiên trên thiết bị. Chọn đến trang đăng nhập để thử dọn phiên lại."
          : "Chưa xác định được mật khẩu đã đổi hay chưa. Hãy thử đăng nhập bằng mật khẩu mới; nếu không được, yêu cầu email khôi phục. Không gửi lại yêu cầu đổi mật khẩu.");
        return;
      }
      setError(mode === "change" && cause instanceof ApiError && cause.status === 401
        ? "Mật khẩu hiện tại chưa đúng hoặc phiên đăng nhập đã hết hạn."
        : mode === "reset" && cause instanceof ApiError && cause.status === 400
          ? "Mã đã hết hạn, đã dùng hoặc mật khẩu chưa hợp lệ. Hãy yêu cầu email mới nếu cần."
          : authErrorMessage(cause));
    } finally { locked.current = false; setBusy(false); }
  }
  // Keep the completed flow mounted during local cleanup; a surrounding AuthGate
  // would race the success navigation and replace its sign-in notice.
  if (mode === "change" && status !== "authenticated" && !finished) return <AuthGate><Text /></AuthGate>;
  return <Screen title={title}>
    <Heading title={title} subtitle={mode === "request" ? "Nhận liên kết khôi phục qua email." : "Mật khẩu mới cần từ 8 đến 128 ký tự."} />
    {error && <Feedback message={error} />}
    {sent && <Feedback success message="Yêu cầu đã được tiếp nhận. Nếu email thuộc tài khoản hợp lệ, bạn sẽ nhận được liên kết khôi phục." />}
    {mode === "request" ? <FormField icon="mail" label="Email" value={email} onChangeText={value => { setEmail(value); setSent(false); setError(undefined); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} maxLength={255} /> : <>
      {mode === "reset" ? <FormField icon="mail" label="Mã hoặc liên kết đặt lại mật khẩu" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} editable={!busy && !uncertain && !finished} /> : <FormField icon="lock" label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" editable={!busy && !uncertain && !finished} />}
      <FormField icon="lock" label="Mật khẩu mới" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!busy && !uncertain && !finished} />
      <FormField icon="lock" label="Nhập lại mật khẩu mới" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!busy && !uncertain && !finished} />
      <Text style={typography.footnote}>Sau khi lưu, tất cả phiên đăng nhập sẽ bị thu hồi. Bạn cần đăng nhập lại bằng mật khẩu mới.</Text>
    </>}
    <Button label={mode === "request" ? "Gửi email khôi phục" : "Lưu mật khẩu mới"} loading={busy} disabled={uncertain || finished || (mode === "request" && sent)} onPress={() => { void submit(); }} />
    {uncertain && <Button label="Đến trang đăng nhập" variant="soft" onPress={() => { setFinished(true); void clearLocalSession().then(() => router.replace("/sign-in")).catch(cause => { setFinished(false); setError(authErrorMessage(cause)); }); }} />}
    {mode === "request" && <Button label="Tôi đã có mã khôi phục" variant="soft" disabled={busy} onPress={() => router.push("/reset-password")} />}
    {mode === "reset" && <Button label="Yêu cầu email mới" variant="soft" disabled={busy} onPress={() => router.replace("/forgot-password")} />}
  </Screen>;
}
