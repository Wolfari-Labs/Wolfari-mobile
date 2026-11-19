import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Text } from "react-native";

import { apiClient } from "@/shared/api/client";
import { ApiError } from "@/shared/api/api-client";
import { useApi } from "@/shared/api/use-api";
import { getMailpitUrl } from "@/shared/config/mailpit-url";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { Heading } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { accountToken, isEmailCode } from "../account-validation";
import { createAccountApi } from "../api/account.api";
import { authErrorMessage } from "../auth-errors";
import { CodeField } from "../components/code-field";
import { useSession } from "../session/session-provider";
import type { Profile } from "../types";
import { useAccountLink } from "../use-account-link";
import { useResendCooldown } from "../use-resend-cooldown";
import { validateLogin } from "../validation";
import { pendingInvitation } from "@/features/trips/pending-invitation";

const publicApi = createAccountApi(apiClient);
const CODE_REJECTED = "Mã chưa đúng hoặc đã hết hạn. Kiểm tra email mới nhất; sai 5 lần thì cần gửi lại mã.";

export default function VerifyEmailScreen() {
  const api = useApi();
  const { status, profile, updateProfile } = useSession();
  const params = useLocalSearchParams<{ email?: string; sent?: string }>();
  const mailpit = getMailpitUrl();
  const [input, setInput] = useAccountLink();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string>();
  const cooldown = useResendCooldown(60, params.sent === "1");
  const locked = useRef(false);
  const knownEmail = profile?.email ?? email;
  const linkMode = manual || !!input;

  async function after(work: () => Promise<unknown>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(undefined);
    try { await work(); }
    catch (cause) { setError(cause instanceof ApiError && cause.status === 400 ? CODE_REJECTED : authErrorMessage(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  async function markVerified() {
    setVerified(true); setInput(""); setCode("");
    if (status === "authenticated") {
      // Confirmation succeeded even if reloading the profile is temporarily unavailable.
      try { updateProfile(await api.request<Profile>("/me")); } catch { /* refreshed on next login */ }
    }
  }
  function confirmCode(value = code) {
    const target = knownEmail.trim();
    if (validateLogin(target, "unused").email) { setError("Nhập email đã đăng ký."); return; }
    if (!isEmailCode(value)) { setError("Nhập đủ 6 số trong email."); return; }
    void after(async () => { await publicApi.confirmEmailCode(target, value); await markVerified(); });
  }
  function confirmLink(value = input) {
    const token = accountToken(value);
    if (!token) { setError("Dán liên kết xác minh trong email."); return; }
    void after(async () => { await publicApi.confirmEmail(token); await markVerified(); });
  }
  async function pasteAndConfirm() {
    const text = await Clipboard.getStringAsync().catch(() => "");
    if (!accountToken(text)) { setError("Bộ nhớ tạm chưa có liên kết xác minh. Hãy sao chép liên kết trong email trước."); return; }
    setInput(text);
    confirmLink(text);
  }
  function resend() {
    void after(async () => {
      await api.account.resendVerification();
      setSent(true); setCode(""); cooldown.start();
    });
  }
  function refreshVerification() {
    void after(async () => {
      const next = await api.request<Profile>("/me");
      updateProfile(next);
      if (next.email_verified_at) setVerified(true);
      else setError("Email chưa được xác minh. Nhập mã 6 số trong email rồi bấm Xác minh.");
    });
  }

  const done = verified || (profile?.email_verified_at && !input);
  return <Screen title="Xác minh email">
    <Heading
      title={done ? "Email đã xác minh" : "Nhập mã xác minh"}
      subtitle={done ? knownEmail : knownEmail ? `Mã 6 số đã được gửi tới ${knownEmail}.` : "Mã 6 số nằm trong email Wolfari vừa gửi cho bạn."}
    />
    {error && <Feedback message={error} />}
    {done ? <>
      <Feedback success message={profile?.email_verified_at ? "Email của tài khoản đã được xác minh." : "Email đã được xác minh. Hãy đăng nhập để tiếp tục."} />
      <Button label={status === "authenticated" ? pendingInvitation.get() ? "Tiếp tục lời mời" : "Về tài khoản" : "Đăng nhập"} onPress={() => router.replace(status === "authenticated" ? pendingInvitation.get() ? "/invitation" : "/(tabs)/profile" : "/sign-in")} />
    </> : <>
      {sent && <Feedback success message="Đã gửi lại mã. Mã cũ không còn dùng được; kiểm tra cả thư mục thư rác." />}
      {!profile?.email && !params.email && <FormField icon="mail" label="Email" value={email} onChangeText={value => { setEmail(value); setError(undefined); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} maxLength={255} />}
      {!linkMode && <>
        <CodeField label="Mã xác minh 6 số" value={code} onChange={value => { setCode(value); setError(undefined); }} onComplete={confirmCode} editable={!busy} invalid={!!error} />
        <Button label="Xác minh" loading={busy} disabled={!isEmailCode(code)} onPress={() => confirmCode()} />
        {status === "authenticated"
          ? <Button label={cooldown.left ? `Gửi lại mã sau ${cooldown.left} giây` : "Gửi lại mã"} variant="text" disabled={busy || cooldown.left > 0} onPress={resend} />
          : <Button label="Đăng nhập để gửi lại mã" variant="text" disabled={busy} onPress={() => router.push("/sign-in")} />}
        {status === "authenticated" && <Button label="Tôi đã xác minh" variant="text" disabled={busy} onPress={refreshVerification} />}
      </>}
      <Button label={linkMode ? "Nhập mã 6 số" : "Dùng liên kết trong email"} variant="text" disabled={busy} onPress={() => { setManual(!linkMode); setInput(""); setError(undefined); }} />
      {linkMode && <>
        <Text style={typography.footnote}>Dán liên kết xác minh từ email (dùng khi email chưa có mã số).</Text>
        <Button label="Dán & xác nhận" loading={busy} onPress={() => { void pasteAndConfirm(); }} />
        <FormField icon="mail" label="Mã hoặc liên kết xác minh" value={input} onChangeText={value => { setInput(value); setError(undefined); }} autoCapitalize="none" autoCorrect={false} editable={!busy} />
        <Button label="Xác nhận email" variant="soft" disabled={busy || !input.trim()} onPress={() => confirmLink()} />
      </>}
      {mailpit && <Button label="Mở hộp thư thử nghiệm" variant="text" disabled={busy} onPress={() => { Linking.openURL(mailpit).catch(() => setError('Không mở được hộp thư thử nghiệm. Kiểm tra kết nối mạng.')); }} />}
    </>}
  </Screen>;
}
