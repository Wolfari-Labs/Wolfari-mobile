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

export function passwordError(password: string, confirmation: string): string | undefined {
  const length = [...password].length;
  if (length < 15 || length > 128) return "Mật khẩu phải có từ 15 đến 128 ký tự.";
  if (password !== confirmation) return "Mật khẩu xác nhận chưa khớp.";
}
