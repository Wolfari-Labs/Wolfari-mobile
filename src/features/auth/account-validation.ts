// A pasted email link is parsed locally, never fetched or followed with credentials.
export function accountToken(input: string): string | undefined {
  let value = input.trim();
  if (value.includes("://")) {
    try {
      const url = new URL(value);
      value = url.searchParams.get("token") ?? new URLSearchParams(url.hash.slice(1)).get("token") ?? "";
    } catch { return; }
  }
  return /^[A-Za-z0-9_-]{32,200}$/.test(value) ? value : undefined;
}

export const EMAIL_CODE_LENGTH = 6;
/** Keeps typed or pasted digits only ("123 456" from the email works). */
export function emailCodeInput(input: string): string {
  return input.replace(/[^0-9]/g, "").slice(0, EMAIL_CODE_LENGTH);
}
export const isEmailCode = (value: string) => /^[0-9]{6}$/.test(value);

export function passwordError(password: string, confirmation: string): string | undefined {
  const length = [...password].length;
  if (length < 8 || length > 128) return "Mật khẩu phải có từ 8 đến 128 ký tự.";
  if (password !== confirmation) return "Mật khẩu xác nhận chưa khớp.";
}
