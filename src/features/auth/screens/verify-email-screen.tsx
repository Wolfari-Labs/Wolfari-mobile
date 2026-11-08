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
  const [error, setError] = useState<string>();
  const locked = useRef(false);
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
    <Heading title="Xác minh email" subtitle={profile?.email ?? "Dùng liên kết được gửi khi đăng ký."} />
    {error && <Feedback message={error} />}
    {verified || (profile?.email_verified_at && !input) ? <>
      <Feedback success message={profile?.email_verified_at ? "Email của tài khoản đã được xác minh." : "Liên kết xác minh đã được xác nhận."} />
      <Button label={status === "authenticated" ? pendingInvitation.get() ? "Tiếp tục lời mời" : "Về tài khoản" : "Đăng nhập"} onPress={() => router.replace(status === "authenticated" ? pendingInvitation.get() ? "/invitation" : "/(tabs)/profile" : "/sign-in")} />
    </> : <>
      {sent && <Feedback success message="Đã tiếp nhận yêu cầu gửi lại email. Kiểm tra cả thư mục thư rác." />}
      <Text style={typography.body}>{mailpit ? "1. Mở hộp thư Mailpit, mở email xác minh và sao chép liên kết.\n2. Quay lại app, bấm “Dán & xác nhận”." : "Sao chép liên kết hoặc mã trong email, rồi bấm “Dán & xác nhận”. Liên kết chỉ dùng được một lần."}</Text>
      {mailpit && <Button label="Mở hộp thư Mailpit" variant="soft" disabled={busy} onPress={() => { Linking.openURL(mailpit).catch(() => setError(`Không mở được ${mailpit}. Kiểm tra điện thoại và máy tính cùng mạng Wi‑Fi, và firewall cho phép cổng 8025.`)); }} />}
      <Button label="Dán & xác nhận" loading={busy} onPress={() => { void pasteAndConfirm(); }} />
      <FormField icon="mail" label="Mã hoặc liên kết xác minh" value={input} onChangeText={value => { setInput(value); setError(undefined); }} autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <Button label="Xác nhận email" variant="soft" disabled={busy || !input.trim()} onPress={() => { void run(false); }} />
      {status === "authenticated" && <Button label="Gửi lại email xác minh" variant="soft" disabled={sent || busy} onPress={() => { void run(true); }} />}
    </>}
  </Screen>;
}
