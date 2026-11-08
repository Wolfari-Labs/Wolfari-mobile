import { getApiBaseUrl } from "./env";

// Dev-only: Mailpit runs next to the local Gateway, so reuse the Gateway host the phone already reaches.
export function getMailpitUrl(): string | undefined {
  if (!__DEV__) return;
  const configured = process.env.EXPO_PUBLIC_MAILPIT_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  try { return `http://${new URL(getApiBaseUrl()).hostname}:8025`; } catch { return; }
}
