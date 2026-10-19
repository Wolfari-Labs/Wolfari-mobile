import { useRef, useState } from "react";
import { Text } from "react-native";

import { apiClient } from "@/shared/api/client";
import { useApi } from "@/shared/api/use-api";
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

export default function VerifyEmailScreen() {
  const api = useApi();
  const { status, profile, updateProfile } = useSession();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string>();
  const locked = useRef(false);
  async function run(resend: boolean) {
    if (locked.current) return;
    const token = accountToken(input);
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
    {verified || profile?.email_verified_at ? <Feedback success message="Email của tài khoản đã được xác minh." /> : <>
      {sent && <Feedback success message="Đã tiếp nhận yêu cầu gửi lại email. Kiểm tra cả thư mục thư rác." />}
      <Text style={typography.body}>Dán liên kết hoặc mã từ email, sau đó bấm xác nhận. Liên kết chỉ dùng được một lần.</Text>
      <FormField icon="mail" label="Mã hoặc liên kết xác minh" value={input} onChangeText={setInput} autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <Button label="Xác nhận email" loading={busy} onPress={() => { void run(false); }} />
      {status === "authenticated" && <Button label="Gửi lại email xác minh" variant="soft" disabled={sent || busy} onPress={() => { void run(true); }} />}
    </>}
  </Screen>;
}
