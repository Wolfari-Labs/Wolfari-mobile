// Opt-in developer tool. Real SMTP delivery must never be presented as a Mailpit flow.
export function getMailpitUrl(): string | undefined {
  if (!__DEV__) return;
  const configured = process.env.EXPO_PUBLIC_MAILPIT_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
}
