import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Text } from "react-native";

import { apiClient } from "@/shared/api/client";
import { useApi } from "@/shared/api/use-api";
import { getMailpitUrl } from "@/shared/config/mailpit-url";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { Heading } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { accountToken } from "../account-validation";
import { createAccountApi } from "../api/account.api";
import { authErrorMessage } from "../auth-errors";
import { useSession } from "../session/session-provider";
import type { Profile } from "../types";
import { useAccountLink } from "../use-account-link";
import { pendingInvitation } from "@/features/trips/pending-invitation";

export default function VerifyEmailScreen() {
  const api = useApi();
  const { status, profile, updateProfile } = useSession();
  const mailpit = getMailpitUrl();
  const [input, setInput] = useAccountLink();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string>();
  const locked = useRef(false);
  async function refreshVerification() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(undefined);
    try {
      const next = await api.request<Profile>('/me');
      updateProfile(next);
      if (next.email_verified_at) setVerified(true);
      else setError('Email chưa được xác minh. Hãy mở thư và bấm liên kết xác minh rồi kiểm tra lại.');
    } catch (cause) { setError(authErrorMessage(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  async function pasteAndConfirm() {
    const text = await Clipboard.getStringAsync().catch(() => "");
    if (!accountToken(text)) { setError("Bộ nhớ tạm chưa có liên kết hoặc mã xác minh. Hãy sao chép liên kết trong email trước."); return; }
    setInput(text);
    await run(false, text);
  }
  async function run(resend: boolean, value = input) {
    if (locked.current) return;
    const token = accountToken(value);
    if (!resend && !token) { setError("Dán mã hoặc liên kết xác minh trong email."); return; }
    locked.current = true; setBusy(true); setError(undefined);
    try {
      if (resend) { await api.account.resendVerification(); setSent(true); }
      else {
        await createAccountApi(apiClient).confirmEmail(token!);
        setVerified(true); setInput("");
        if (status === "authenticated") {
          // Confirmation succeeded even if reloading the profile is temporarily unavailable.
          try { updateProfile(await api.request<Profile>("/me")); } catch { /* refreshed on next login */ }
        }
      }
    } catch (cause) { setError(authErrorMessage(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <Screen title="Xác minh email">
    <Heading title={verified || profile?.email_verified_at ? "Email đã xác minh" : "Kiểm tra hộp thư"} subtitle={profile?.email} />
    {error && <Feedback message={error} />}
    {verified || (profile?.email_verified_at && !input) ? <>
      <Feedback success message={profile?.email_verified_at ? "Email của tài khoản đã được xác minh." : "Liên kết xác minh đã được xác nhận."} />
      <Button label={status === "authenticated" ? pendingInvitation.get() ? "Tiếp tục lời mời" : "Về tài khoản" : "Đăng nhập"} onPress={() => router.replace(status === "authenticated" ? pendingInvitation.get() ? "/invitation" : "/(tabs)/profile" : "/sign-in")} />
    </> : <>
      {sent && <Feedback success message="Đã tiếp nhận yêu cầu gửi lại email. Kiểm tra cả thư mục thư rác." />}
      <Text style={typography.body}>Mở email Wolfari trên điện thoại và bấm liên kết xác minh. Nếu chưa thấy thư, kiểm tra mục thư rác.</Text>
      {!input && (status === 'authenticated'
        ? <Button label="Tôi đã xác minh" loading={busy} onPress={() => { void refreshVerification(); }} />
        : <Button label="Đăng nhập sau xác minh" onPress={() => router.replace('/sign-in')} />)}
      {status === "authenticated" && <Button label="Gửi lại email xác minh" variant="text" disabled={sent || busy} onPress={() => { void run(true); }} />}
      {!input && <Button label={manual ? 'Ẩn nhập thủ công' : 'Nhập liên kết thủ công'} variant="text" onPress={() => setManual(value => !value)} />}
      {(manual || !!input) && <>
      <Button label="Dán & xác nhận" loading={busy} onPress={() => { void pasteAndConfirm(); }} />
      <FormField icon="mail" label="Mã hoặc liên kết xác minh" value={input} onChangeText={value => { setInput(value); setError(undefined); }} autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <Button label="Xác nhận email" variant="soft" disabled={busy || !input.trim()} onPress={() => { void run(false); }} />
      </>}
      {mailpit && <Button label="Mở hộp thư thử nghiệm" variant="text" disabled={busy} onPress={() => { Linking.openURL(mailpit).catch(() => setError('Không mở được hộp thư thử nghiệm. Kiểm tra kết nối mạng.')); }} />}
    </>}
  </Screen>;
}
